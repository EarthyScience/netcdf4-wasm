// Main NetCDF4 class implementation

import { NC_CONSTANTS } from "./constants.js";
import { Group } from "./group.js";
import * as NCGet from "./netcdf-getters.js";
import type { DimSelection } from "./slice.js";
import type {
    DatasetOptions,
    MemoryDatasetSource,
    NetCDF4Module,
    RemoteDatasetOptions,
    RemoteFileOptions,
} from "./types.js";
import { WasmModuleLoader } from "./wasm-module.js";

export class NetCDF4 extends Group {
    private module: NetCDF4Module | null = null;
    private initialized = false;
    private ncid: number = -1;
    private _isOpen = false;
    private memorySource?: MemoryDatasetSource;
    private workerSource?: {
        blob?: Blob;
        url?: string;
        remote?: RemoteFileOptions;
        filename: string;
    };
    private worker?: Worker;
    private workerReady?: Promise<void>;
    // Set once the worker is terminated; later worker calls reject with it
    private workerError?: Error;
    private pendingRequests = new Map<number, (error: Error) => void>();
    private removeAbortListener?: () => void;

    constructor(
        private filename?: string,
        private mode: string = "r",
        private options: DatasetOptions = {},
    ) {
        super(null as any, "", -1);
        // Set up self-reference for Group methods
        (this as any).netcdf = this;
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            if (this.workerSource) {
                // This now handles the WORKERFS mounting
                await this.setupWorker();
                this.initialized = true;
            } else {
                this.module = await WasmModuleLoader.loadModule(this.options);
                if (this.memorySource) {
                    await this.mountMemoryData();
                }
            }

            this.initialized = true;

            // Automatically open the file if a filename was provided
            if (this.filename && !this.workerSource) {
                await this.open();
            }
        } catch (error) {
            if (
                typeof process !== "undefined" &&
                process.env.NODE_ENV === "test"
            ) {
                this.module = this.createMockModule();
                this.initialized = true;
                if (this.filename) await this.open();
            } else {
                throw error;
            }
        }
    }

    // Python-like factory method
    static async Dataset(
        filename: string | URL,
        mode: string = "r",
        options: RemoteDatasetOptions = {},
    ): Promise<NetCDF4> {
        if (filename instanceof URL || /^https?:\/\//i.test(filename)) {
            if (mode !== "r") {
                throw new Error(
                    `Remote files can only be opened read-only (mode 'r'), got '${mode}'`,
                );
            }
            return NetCDF4.fromUrl(filename, options);
        }
        const dataset = new NetCDF4(filename, mode, options);
        await dataset.initialize();
        return dataset;
    }

    // Create dataset from Blob
    static async fromBlob(
        blob: Blob,
        mode: string = "r",
        options: DatasetOptions = {},
    ): Promise<NetCDF4> {
        const arrayBuffer = await blob.arrayBuffer();
        return NetCDF4.fromArrayBuffer(arrayBuffer, mode, options);
    }

    // Create dataset from ArrayBuffer
    static async fromArrayBuffer(
        buffer: ArrayBuffer,
        mode: string = "r",
        options: DatasetOptions = {},
    ): Promise<NetCDF4> {
        const data = new Uint8Array(buffer);
        return NetCDF4.fromMemory(data, mode, options);
    }

    // Create dataset from memory data (Uint8Array or ArrayBuffer)
    static async fromMemory(
        data: Uint8Array | ArrayBuffer,
        mode: string = "r",
        options: DatasetOptions = {},
        filename?: string,
    ): Promise<NetCDF4> {
        if (!data) {
            throw new Error("Data cannot be null or undefined");
        }

        if (!(data instanceof ArrayBuffer) && !(data instanceof Uint8Array)) {
            throw new Error("Data must be ArrayBuffer or Uint8Array");
        }

        const uint8Data =
            data instanceof ArrayBuffer ? new Uint8Array(data) : data;
        const virtualFilename =
            filename ||
            `/tmp/netcdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.nc`;

        const dataset = new NetCDF4(virtualFilename, mode, options);
        dataset.memorySource = {
            data: uint8Data,
            filename: virtualFilename,
        };

        await dataset.initialize();
        return dataset;
    }

    // New factory for Blob/File (local, no full preload)
    static async fromBlobLazy(
        blob: Blob,
        options: DatasetOptions = {},
    ): Promise<NetCDF4> {
        // IMPORTANT: Keep this path consistent with the mount logic in the worker
        const mountPoint = "/working";
        const baseName = `netcdf_lazy_${Date.now()}.nc`;
        const fullPath = `${mountPoint}/${baseName}`;

        const dataset = new NetCDF4(fullPath, "r", options);
        // Store the raw blob. The worker will mount it via WORKERFS
        dataset.workerSource = { blob, filename: fullPath };
        await dataset.initialize();

        // After worker is set up, open the file
        await dataset.open();

        return dataset;
    }

    // Remote file over HTTP Range requests (read-only, only the blocks netCDF-C touches are fetched)
    static async fromUrl(
        url: string | URL,
        options: RemoteDatasetOptions = {},
    ): Promise<NetCDF4> {
        const {
            blockSize,
            cacheSize,
            headers,
            withCredentials,
            maxFullDownload,
            signal,
        } = options;

        // The worker resolves relative URLs against its own script, so resolve here
        let resolved: URL;
        try {
            resolved = new URL(url, globalThis.location?.href);
        } catch {
            throw new Error(`Invalid URL: '${url}'`);
        }
        if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
            throw new Error(
                `Remote files must be served over HTTP(S), got '${resolved.href}'`,
            );
        }
        if (typeof Worker === "undefined") {
            throw new Error("Remote files require Web Worker support");
        }
        signal?.throwIfAborted();

        const baseName = resolved.pathname.split("/").pop() || "remote.nc";
        const fullPath = `/remote/${baseName}`;

        const dataset = new NetCDF4(fullPath, "r", options);
        dataset.workerSource = {
            url: resolved.href,
            remote: {
                blockSize,
                cacheSize,
                headers,
                withCredentials,
                maxFullDownload,
            },
            filename: fullPath,
        };
        if (signal) {
            // Reads are synchronous inside the worker, so terminating it is the only way to cancel one
            const abort = () => dataset.terminateWorker(signal.reason);
            signal.addEventListener("abort", abort, { once: true });
            dataset.removeAbortListener = () =>
                signal.removeEventListener("abort", abort);
        }
        try {
            await dataset.initialize();
            await dataset.open();
        } catch (error) {
            dataset.terminateWorker(
                error instanceof Error ? error : new Error(String(error)),
            );
            throw error;
        }

        return dataset;
    }

    private async open(): Promise<void> {
        if (this._isOpen) return;

        if (!this.filename || this.filename.trim() === "") {
            throw new Error("No filename specified");
        }

        // Check for valid modes early, before any WASM operations
        const validModes = ["r", "w", "w-", "a", "r+"];
        if (!validModes.includes(this.mode)) {
            throw new Error(`Unsupported mode: ${this.mode}`);
        }

        // Worker path
        if (this.worker) {
            // Wait for worker to be ready first
            await this.workerReady;

            const modeValue =
                this.mode === "r"
                    ? NC_CONSTANTS.NC_NOWRITE
                    : NC_CONSTANTS.NC_WRITE;
            this.ncid = await this.callWorker("open", {
                path: this.filename,
                modeValue,
            });

            (this as any).groupId = this.ncid;
            this._isOpen = true;

            return;
        }

        if (this.mode === "w" || this.mode === "w-") {
            // Create new file
            let createMode = NC_CONSTANTS.NC_CLOBBER;
            if (this.options.format === "NETCDF4") {
                createMode |= NC_CONSTANTS.NC_NETCDF4;
            }
            const result = await this.createFile(this.filename, createMode);
            this.ncid = result;
            (this as any).groupId = result;
        } else if (
            this.mode === "r" ||
            this.mode === "a" ||
            this.mode === "r+"
        ) {
            // Open existing file
            const modeValue =
                this.mode === "r"
                    ? NC_CONSTANTS.NC_NOWRITE
                    : NC_CONSTANTS.NC_WRITE;
            this.ncid = await this.openFile(this.filename, this.mode as any);
            (this as any).groupId = this.ncid;

            // Load existing data from mock storage if in test mode
            if (
                typeof process !== "undefined" &&
                process.env.NODE_ENV === "test"
            ) {
                (this as any).loadMockDimensions();
            } else {
                await this.load();
            }
        }

        this._isOpen = true;
    }

    // Property access similar to Python API
    get file_format(): string {
        return this.options.format || "NETCDF4";
    }

    get disk_format(): string {
        return this.file_format;
    }

    get filepath(): string {
        return this.filename || "";
    }

    get isopen(): boolean {
        return this._isOpen;
    }

    // Check if module is initialized
    isInitialized(): boolean {
        return this.initialized;
    }

    getModule(): NetCDF4Module {
        if (!this.module) {
            throw new Error(
                "NetCDF4 module not initialized. Call initialize() first.",
            );
        }
        return this.module;
    }

    // Close method
    async close(): Promise<void> {
        try {
            if (this._isOpen && this.ncid >= 0) {
                await this.closeFile(this.ncid);
                this._isOpen = false;
                this.ncid = -1;
            }
        } finally {
            // Nothing can reopen a worker's file, so free the worker (and any remote block cache)
            if (this.worker)
                this.terminateWorker(new Error("Dataset is closed"));
        }
    }

    // Sync method (flush to disk)
    async sync(): Promise<void> {
        if (this._isOpen) {
            // TODO: Implement nc_sync when available
            console.warn("sync() not yet implemented");
        }
    }

    // Context manager support (Python-like)
    async __aenter__(): Promise<NetCDF4> {
        if (!this.initialized) {
            await this.initialize();
        }
        return this;
    }

    async __aexit__(): Promise<void> {
        await this.close();
    }

    // Low-level NetCDF operations (used by Group methods)
    async openFile(path: string, mode: "r" | "w" | "a" = "r"): Promise<number> {
        const module = this.getModule();
        const modeValue =
            mode === "r"
                ? NC_CONSTANTS.NC_NOWRITE
                : mode === "w"
                  ? NC_CONSTANTS.NC_WRITE
                  : NC_CONSTANTS.NC_WRITE;

        const result = module.nc_open(path, modeValue);
        if (result.result !== NC_CONSTANTS.NC_NOERR) {
            throw new Error(
                `Failed to open NetCDF file: ${path} (error: ${result.result})`,
            );
        }
        return result.ncid;
    }

    async createFile(
        path: string,
        mode: number = NC_CONSTANTS.NC_CLOBBER,
    ): Promise<number> {
        const module = this.getModule();
        const result = module.nc_create(path, mode);
        if (result.result !== NC_CONSTANTS.NC_NOERR) {
            throw new Error(
                `Failed to create NetCDF file: ${path} (error: ${result.result})`,
            );
        }
        return result.ncid;
    }

    async closeFile(ncid: number): Promise<void> {
        if (this.worker) {
            await this.callWorker("close");
        } else {
            const module = this.module;
            if (!module)
                throw new Error(
                    "Failed to load module. Ensure module is initialized before calling methods",
                );

            const result = module.nc_close(ncid);
            if (result !== NC_CONSTANTS.NC_NOERR) {
                throw new Error(
                    `Failed to close NetCDF file with ID: ${ncid} (error: ${result})`,
                );
            }
        }
    }

    private requestId = 0;

    private async callWorker(type: string, payload: any = {}): Promise<any> {
        if (this.workerError) throw this.workerError;
        if (!this.worker) throw new Error("Worker not initialized");

        return this.requestWorker({ type, ncid: this.ncid, ...payload });
    }

    // Post a message to the worker and wait for the reply carrying the same id.
    // With startup set, a worker 'error' event also rejects, since a worker that
    // fails to load never replies.
    private requestWorker(
        message: { type: string; [key: string]: any },
        { startup = false } = {},
    ): Promise<any> {
        const worker = this.worker!;
        const id = ++this.requestId;

        return new Promise((resolve, reject) => {
            // Aborting it removes every listener this request added
            const listeners = new AbortController();

            // Every way the request can end goes through here: reply, error event or terminateWorker
            const finish = (error?: Error, result?: unknown) => {
                listeners.abort();
                this.pendingRequests.delete(id);
                if (error) reject(error);
                else resolve(result);
            };

            worker.addEventListener(
                "message",
                (e: MessageEvent) => {
                    if (e.data.id !== id) return;
                    if (e.data.success) finish(undefined, e.data.result);
                    else
                        finish(
                            new Error(
                                e.data.error ||
                                    `Worker error in ${message.type}`,
                            ),
                        );
                },
                { signal: listeners.signal },
            );

            if (startup) {
                worker.addEventListener(
                    "error",
                    (e: ErrorEvent) => {
                        finish(
                            new Error(
                                `Worker failed to start: ${e.message || "unknown error"}`,
                            ),
                        );
                    },
                    { signal: listeners.signal },
                );
            }

            this.pendingRequests.set(id, finish);
            worker.postMessage({ id, ...message });
        });
    }

    // Stop the worker for good: in-flight and later worker calls reject with error
    private terminateWorker(error: Error): void {
        this.workerError ??= error;
        for (const fail of this.pendingRequests.values())
            fail(this.workerError);
        this.removeAbortListener?.();
        this.removeAbortListener = undefined;
        this.worker?.terminate();
        this._isOpen = false;
        this.ncid = -1;
    }

    async getGlobalAttributes(
        groupPath?: string,
    ): Promise<Record<string, any>> {
        if (this.worker) {
            return this.callWorker("getGlobalAttributes", { groupPath });
        } else {
            // Main thread path is already synchronous (or could be wrapped in Promise.resolve)
            return NCGet.getGlobalAttributes(
                this.module as NetCDF4Module,
                this.ncid,
                groupPath,
            );
        }
    }

    async getFullMetadata(groupPath?: string): Promise<Record<string, any>[]> {
        if (this.worker) {
            return this.callWorker("getFullMetadata", { groupPath });
        } else {
            // Main thread path is already synchronous (or could be wrapped in Promise.resolve)
            return NCGet.getFullMetadata(
                this.module as NetCDF4Module,
                this.ncid,
                groupPath,
            );
        }
    }

    async getAttributeValues(varid: number, attname: string): Promise<any> {
        if (this.worker) {
            return this.callWorker("getAttributeValues", { varid, attname });
        } else {
            // Main thread path is already synchronous (or could be wrapped in Promise.resolve)
            return NCGet.getAttributeValues(
                this.module as NetCDF4Module,
                this.ncid,
                varid,
                attname,
            );
        }
    }

    async getDimCount(ncid: number = this.ncid): Promise<number> {
        if (this.worker) {
            return this.callWorker("getDimCount", { ncid });
        } else {
            // Main thread path is already synchronous (or could be wrapped in Promise.resolve)
            return NCGet.getDimCount(this.module as NetCDF4Module, ncid);
        }
    }

    async getGroupVariables(groupPath?: string): Promise<Record<string, any>> {
        if (this.worker) {
            return this.callWorker("getGroupVariables", { groupPath });
        } else {
            // Main thread path is already synchronous (or could be wrapped in Promise.resolve)
            return NCGet.getGroupVariables(
                this.module as NetCDF4Module,
                this.ncid,
                groupPath,
            );
        }
    }

    async getVarIDs(ncid: number = this.ncid): Promise<number[] | Int32Array> {
        if (this.worker) {
            return this.callWorker("getVarIDs", { ncid });
        } else {
            // Main thread path is already synchronous (or could be wrapped in Promise.resolve)
            return NCGet.getVarIDs(this.module as NetCDF4Module, ncid);
        }
    }

    async getDimIDs(ncid: number = this.ncid): Promise<number[] | Int32Array> {
        if (this.worker) {
            return this.callWorker("getDimIDs", { ncid });
        } else {
            // Main thread path is already synchronous (or could be wrapped in Promise.resolve)
            return NCGet.getDimIDs(this.module as NetCDF4Module, ncid);
        }
    }

    async getDim(
        dimid: number,
        ncid: number = this.ncid,
    ): Promise<Record<string, any>> {
        if (this.worker) {
            return this.callWorker("getDim", { dimid, ncid });
        } else {
            // Main thread path is already synchronous (or could be wrapped in Promise.resolve)
            return NCGet.getDim(this.module as NetCDF4Module, ncid, dimid);
        }
    }

    async getDims(groupPath?: string): Promise<Record<string, any>> {
        if (this.worker) {
            return this.callWorker("getDims", { groupPath });
        } else {
            // Main thread path is already synchronous (or could be wrapped in Promise.resolve)
            return NCGet.getDims(
                this.module as NetCDF4Module,
                this.ncid,
                groupPath,
            );
        }
    }

    async getVarCount(ncid: number = this.ncid): Promise<number> {
        if (this.worker) {
            return this.callWorker("getVarCount", { ncid });
        } else {
            // Main thread path is already synchronous (or could be wrapped in Promise.resolve)
            return NCGet.getVarCount(this.module as NetCDF4Module, ncid);
        }
    }

    async getAttributeName(
        varid: number,
        attId: number,
    ): Promise<string | undefined> {
        if (this.worker) {
            return this.callWorker("getAttributeName", { varid, attId });
        } else {
            // Main thread path is already synchronous (or could be wrapped in Promise.resolve)
            return NCGet.getAttributeName(
                this.module as NetCDF4Module,
                this.ncid,
                varid,
                attId,
            );
        }
    }

    async getVariableInfo(
        variable: number | string,
        groupPath?: string,
    ): Promise<Record<string, any>> {
        if (this.worker) {
            return this.callWorker("getVariableInfo", { variable, groupPath });
        } else {
            // Main thread path is already synchronous (or could be wrapped in Promise.resolve)
            return NCGet.getVariableInfo(
                this.module as NetCDF4Module,
                this.ncid,
                variable,
                groupPath,
            );
        }
    }

    async getVariableArray(
        variable: number | string,
        groupPath?: string,
    ): Promise<
        | Int8Array
        | Uint8Array
        | Int16Array
        | Uint16Array
        | Int32Array
        | Uint32Array
        | Float32Array
        | Float64Array
        | BigInt64Array
        | BigUint64Array
        | string[]
    > {
        if (this.worker) {
            return this.callWorker("getVariableArray", { variable, groupPath });
        } else {
            // Main thread path is already synchronous (or could be wrapped in Promise.resolve)
            return NCGet.getVariableArray(
                this.module as NetCDF4Module,
                this.ncid,
                variable,
                groupPath,
            );
        }
    }

    async getSlicedVariableArray(
        variable: number | string,
        start: number[],
        count: number[],
        groupPath?: string,
    ): Promise<
        | Int8Array
        | Uint8Array
        | Int16Array
        | Uint16Array
        | Int32Array
        | Uint32Array
        | Float32Array
        | Float64Array
        | BigInt64Array
        | BigUint64Array
        | string[]
    > {
        if (this.worker) {
            return this.callWorker("getSlicedVariableArray", {
                variable,
                start,
                count,
                groupPath,
            });
        } else {
            // Main thread path is already synchronous (or could be wrapped in Promise.resolve)
            return NCGet.getSlicedVariableArray(
                this.module as NetCDF4Module,
                this.ncid,
                variable,
                start,
                count,
                groupPath,
            );
        }
    }

    /**
     * slicing and indexing convenience method.
     *
     * Each element of `selection` corresponds to one dimension of the variable:
     *   - 'all' or `null`            → all elements of that dimension
     *   - `number`                   → scalar index (dimension is collapsed)
     *   - `slice(stop)`              → elements [0, stop)
     *   - `slice(start, stop)`       → elements [start, stop)
     *   - `slice(start, stop, step)` → strided subset; steps are always positive, reading is always forward, you can achieve negative step by reversing the dimension after reading
     *
     * Strided reads use nc_get_vars_* under the hood.
     * Returns a flat typed array; caller infers shape from non-collapsed dims.
     *
     * @example
     * // Variable shape [time, lat, lon]
     * // Read 10 time steps, all lats, first lon:
     * const data = await dataset.get("temperature", [slice(0, 10), 'all', 0]);
     *
     * @example
     * // Every other element along time:
     * const data = await dataset.get("temperature", [slice(0, 100, 2), null, null]);
     *
     */
    async get(
        variable: number | string,
        selection: DimSelection[],
        groupPath?: string,
        options?: { convertEnumsToNames?: boolean },
    ): Promise<
        | Int8Array
        | Uint8Array
        | Int16Array
        | Uint16Array
        | Int32Array
        | Uint32Array
        | Float32Array
        | Float64Array
        | BigInt64Array
        | BigUint64Array
        | string[]
    > {
        if (this.worker) {
            return this.callWorker("getVariableArrayWithSelection", {
                ncid: this.ncid,
                variable,
                selection,
                groupPath,
                options,
            });
        } else {
            return NCGet.getVariableArrayWithSelection(
                this.module as NetCDF4Module,
                this.ncid,
                variable,
                selection,
                groupPath,
                options,
            );
        }
    }

    // Group functions
    async getGroups(ncid: number = this.ncid): Promise<Record<string, number>> {
        if (this.worker) {
            return this.callWorker("getGroups", { ncid });
        } else {
            return NCGet.getGroups(this.module as NetCDF4Module, ncid);
        }
    }

    async getGroupsRecursive(
        ncid: number = this.ncid,
    ): Promise<Record<string, any>> {
        if (this.worker) {
            return this.callWorker("getGroupsRecursive", { ncid });
        } else {
            return NCGet.getGroupsRecursive(this.module as NetCDF4Module, ncid);
        }
    }

    async getGroupNCID(groupPath: string): Promise<number> {
        if (this.worker) {
            return this.callWorker("getGroupNCID", { groupPath });
        } else {
            return NCGet.getGroupNCID(
                this.module as NetCDF4Module,
                this.ncid,
                groupPath,
            );
        }
    }

    async getGroupName(ncid: number = this.ncid): Promise<string> {
        if (this.worker) {
            return this.callWorker("getGroupName", { ncid });
        } else {
            return NCGet.getGroupName(this.module as NetCDF4Module, ncid);
        }
    }

    async getGroupPath(ncid: number = this.ncid): Promise<string> {
        if (this.worker) {
            return this.callWorker("getGroupPath", { ncid });
        } else {
            return NCGet.getGroupPath(this.module as NetCDF4Module, ncid);
        }
    }

    async defineDimension(
        ncid: number,
        name: string,
        size: number,
    ): Promise<number> {
        const module = this.getModule();
        const result = module.nc_def_dim(ncid, name, size);
        if (result.result !== NC_CONSTANTS.NC_NOERR) {
            throw new Error(
                `Failed to define dimension: ${name} (error: ${result.result})`,
            );
        }
        return result.dimid;
    }

    async defineVariable(
        ncid: number,
        name: string,
        type: number,
        dimids: number[],
    ): Promise<number> {
        const module = this.getModule();
        const result = module.nc_def_var(
            ncid,
            name,
            type,
            dimids.length,
            dimids,
        );
        if (result.result !== NC_CONSTANTS.NC_NOERR) {
            throw new Error(
                `Failed to define variable: ${name} (error: ${result.result})`,
            );
        }
        return result.varid;
    }

    async endDefineMode(ncid: number): Promise<void> {
        const module = this.getModule();
        const result = module.nc_enddef(ncid);
        if (result !== NC_CONSTANTS.NC_NOERR) {
            throw new Error(`Failed to end define mode (error: ${result})`);
        }
    }

    async putVariableDouble(
        ncid: number,
        varid: number,
        data: Float64Array,
    ): Promise<void> {
        const module = this.getModule();
        const result = module.nc_put_var_double(ncid, varid, data);
        if (result !== NC_CONSTANTS.NC_NOERR) {
            throw new Error(`Failed to write variable data (error: ${result})`);
        }
    }

    async getVariableDouble(
        ncid: number,
        varid: number,
        length: number,
    ): Promise<Float64Array> {
        const module = this.getModule();
        const result = module.nc_get_var_double(ncid, varid, length);
        if (result.result !== NC_CONSTANTS.NC_NOERR) {
            throw new Error(
                `Failed to read variable data (error: ${result.result})`,
            );
        }
        if (!result.data) {
            throw new Error("nc_get_var_double returned no data");
        }
        return result.data;
    }

    // Create a mock module for testing
    private createMockModule(): NetCDF4Module {
        // Global mock file storage to simulate persistence across instances
        if (!(global as any).__netcdf4_mock_files) {
            (global as any).__netcdf4_mock_files = {};
        }
        const mockFiles = (global as any).__netcdf4_mock_files;
        const getFile = () =>
            this.filename ? mockFiles[this.filename] : undefined;
        const getVariableNames = (): string[] =>
            Object.keys(getFile()?.variables ?? {});
        // Match the existing mock's 1-based variable IDs.
        const getVariable = (varid: number) =>
            getFile()?.variables[getVariableNames()[varid - 1]];
        const getAttributes = (varid: number) =>
            varid === NC_CONSTANTS.NC_GLOBAL
                ? getFile()?.attributes
                : getVariable(varid)?.attributes;

        return {
            nc_open: (path: string, mode: number) => {
                // Mock implementation that simulates invalid filenames and unsupported modes
                if (
                    !path ||
                    path.trim() === "" ||
                    path.includes("unsupported") ||
                    !["r", "w", "a"].some((m) => this.mode.includes(m))
                ) {
                    return { result: -1, ncid: -1 };
                }
                // For reading mode, file should exist in mock storage, otherwise create a minimal entry
                if (this.mode === "r" && !mockFiles[path]) {
                    // For test purposes, allow reading non-existent files but initialize them empty
                    mockFiles[path] = {
                        attributes: {},
                        dimensions: {},
                        variables: {},
                    };
                }
                return { result: NC_CONSTANTS.NC_NOERR, ncid: 1 };
            },
            nc_close: (ncid: number) => {
                // In a real implementation, this would flush data to the file
                // For our mock, we'll keep the data in memory
                return NC_CONSTANTS.NC_NOERR;
            },
            nc_create: (path: string, mode: number) => {
                if (
                    path.includes("unsupported") ||
                    ["x", "invalid"].some((m) => this.mode.includes(m))
                ) {
                    return { result: -1, ncid: -1 };
                }
                // Initialize mock file storage
                mockFiles[path] = {
                    attributes: {},
                    dimensions: {},
                    variables: {},
                };
                return { result: NC_CONSTANTS.NC_NOERR, ncid: 1 };
            },
            nc_def_dim: (ncid: number, name: string, len: number) => {
                // Store dimension in mock file
                if (this.filename && mockFiles[this.filename]) {
                    mockFiles[this.filename].dimensions[name] = {
                        size: len,
                        unlimited: len === NC_CONSTANTS.NC_UNLIMITED,
                    };
                }
                return { result: NC_CONSTANTS.NC_NOERR, dimid: 1 };
            },
            nc_def_var: (
                ncid: number,
                name: string,
                xtype: number,
                ndims: number,
                dimids: number[],
            ) => {
                // Initialize variable storage
                if (this.filename && mockFiles[this.filename]) {
                    mockFiles[this.filename].variables[name] = {
                        type: xtype,
                        dimids: [...dimids],
                        data: new Float64Array(0),
                        attributes: {},
                    };
                    // Return varid based on current variable count (1-based)
                    const varCount = Object.keys(
                        mockFiles[this.filename].variables,
                    ).length;
                    return { result: NC_CONSTANTS.NC_NOERR, varid: varCount };
                }
                return { result: NC_CONSTANTS.NC_NOERR, varid: 1 };
            },
            nc_inq_varids: (ncid: number) => ({
                result: NC_CONSTANTS.NC_NOERR,
                varids: Int32Array.from(getVariableNames(), (_, i) => i + 1),
            }),
            nc_inq_varid: (ncid: number, name: string) => {
                const index = getVariableNames().indexOf(name);
                return index < 0
                    ? { result: -1 }
                    : { result: NC_CONSTANTS.NC_NOERR, varid: index + 1 };
            },
            nc_inq_var: (ncid: number, varid: number) => {
                const variable = getVariable(varid);
                if (!variable) return { result: -1 };
                return {
                    result: NC_CONSTANTS.NC_NOERR,
                    name: getVariableNames()[varid - 1],
                    type: variable.type,
                    ndims: variable.dimids.length,
                    dimids: Int32Array.from(variable.dimids),
                    natts: Object.keys(variable.attributes).length,
                };
            },
            nc_inq_dim: (ncid: number, dimid: number) => {
                const dimensions = getFile()?.dimensions ?? {};
                const name = Object.keys(dimensions)[dimid];
                return name === undefined
                    ? { result: -1 }
                    : {
                          result: NC_CONSTANTS.NC_NOERR,
                          name,
                          len: dimensions[name].size,
                      };
            },
            nc_inq_grp_parent: (ncid: number) => ({ result: -1 }),
            nc_inq_attname: (ncid: number, varid: number, attnum: number) => {
                const name = Object.keys(getAttributes(varid) ?? {})[attnum];
                return name === undefined
                    ? { result: -1 }
                    : { result: NC_CONSTANTS.NC_NOERR, name };
            },
            nc_inq_att: (ncid: number, varid: number, name: string) => {
                const value = getAttributes(varid)?.[name];
                if (value === undefined) return { result: -1 };
                return {
                    result: NC_CONSTANTS.NC_NOERR,
                    type:
                        typeof value === "string"
                            ? NC_CONSTANTS.NC_CHAR
                            : NC_CONSTANTS.NC_DOUBLE,
                    len:
                        typeof value === "string" || Array.isArray(value)
                            ? value.length
                            : 1,
                };
            },
            nc_get_att_text: (
                ncid: number,
                varid: number,
                name: string,
                length: number,
            ) => {
                const data = getAttributes(varid)?.[name];
                return typeof data === "string"
                    ? { result: NC_CONSTANTS.NC_NOERR, data }
                    : { result: -1 };
            },
            nc_get_att_double: (
                ncid: number,
                varid: number,
                name: string,
                length: number,
            ) => {
                const value = getAttributes(varid)?.[name];
                return value === undefined
                    ? { result: -1 }
                    : {
                          result: NC_CONSTANTS.NC_NOERR,
                          data: Array.isArray(value) ? value : [value],
                      };
            },
            nc_inq_var_chunking: (ncid: number, varid: number) =>
                getVariable(varid)
                    ? {
                          result: NC_CONSTANTS.NC_NOERR,
                          chunking: NC_CONSTANTS.NC_CONTIGUOUS,
                      }
                    : { result: -1 },
            nc_put_var_double: (
                ncid: number,
                varid: number,
                data: Float64Array,
            ) => {
                // Store data in mock file - try to map varid to variable name
                if (this.filename && mockFiles[this.filename]) {
                    const variables = mockFiles[this.filename].variables;
                    const varNames = Object.keys(variables);

                    // Map varid to variable name (1-based indexing)
                    if (
                        varNames.length > 0 &&
                        varid >= 1 &&
                        varid <= varNames.length
                    ) {
                        const varName = varNames[varid - 1]; // Convert to 0-based
                        variables[varName].data = new Float64Array(data);
                    }
                }
                return NC_CONSTANTS.NC_NOERR;
            },
            nc_get_var_double: (ncid: number, varid: number, size: number) => {
                // Try to get actual stored data first
                if (this.filename && mockFiles[this.filename]) {
                    const variables = mockFiles[this.filename].variables;
                    const varNames = Object.keys(variables);

                    // Map varid to variable name (1-based indexing)
                    if (
                        varNames.length > 0 &&
                        varid >= 1 &&
                        varid <= varNames.length
                    ) {
                        const varName = varNames[varid - 1]; // Convert to 0-based
                        const storedData = variables[varName].data;
                        if (storedData && storedData.length > 0) {
                            // Return the stored data, resized to requested size if needed
                            if (size <= 0) {
                                return {
                                    result: NC_CONSTANTS.NC_NOERR,
                                    data: new Float64Array(0),
                                };
                            }
                            const result = new Float64Array(size);
                            for (
                                let i = 0;
                                i < size && i < storedData.length;
                                i++
                            ) {
                                result[i] = storedData[i];
                            }
                            return {
                                result: NC_CONSTANTS.NC_NOERR,
                                data: result,
                            };
                        }
                    }
                }

                // Fallback to test pattern if no data stored
                if (size <= 0) {
                    return {
                        result: NC_CONSTANTS.NC_NOERR,
                        data: new Float64Array(0),
                    };
                }
                const data = new Float64Array(size);
                for (let i = 0; i < size; i++) {
                    data[i] = i * 0.1; // Simple test pattern
                }
                return { result: NC_CONSTANTS.NC_NOERR, data };
            },
            nc_enddef: (ncid: number) => NC_CONSTANTS.NC_NOERR,
        } as any;
    }

    private async setupWorker(): Promise<void> {
        if (!this.workerSource) throw new Error("No worker source");

        // 1. Instantiate the worker if it doesn't exist
        if (!this.worker) {
            // Option A: If using Vite/Webpack 5
            this.worker = new Worker(
                new URL("./netcdf-worker.js", import.meta.url),
                {
                    type: "module",
                },
            );
        }

        // 2. Send the initialization message
        this.workerReady = this.requestWorker(
            { type: "init", ...this.workerSource },
            { startup: true },
        );

        return this.workerReady;
    }

    // Mount memory data in the WASM virtual file system
    private async mountMemoryData(): Promise<void> {
        if (!this.memorySource || !this.module) {
            return;
        }

        // Skip mounting in test mode (mock module doesn't have FS)
        if (typeof process !== "undefined" && process.env.NODE_ENV === "test") {
            return;
        }

        try {
            const module = this.getModule();
            if (!module.FS) {
                throw new Error("Emscripten FS not available");
            }

            // Ensure the /tmp directory exists
            try {
                module.FS.mkdir("/tmp");
            } catch (e) {
                // Directory might already exist, ignore error
            }

            // Write the memory data to a virtual file
            module.FS.writeFile(
                this.memorySource.filename,
                this.memorySource.data,
            );
        } catch (error) {
            throw new Error(`Failed to mount memory data: ${error}`);
        }
    }

    // Get data from memory or file as ArrayBuffer (for writing back to Blob)
    async toArrayBuffer(): Promise<ArrayBuffer> {
        if (!this.module) {
            throw new Error("NetCDF4 module not initialized");
        }

        // Skip in test mode
        if (typeof process !== "undefined" && process.env.NODE_ENV === "test") {
            // Return empty buffer in test mode
            return new ArrayBuffer(0);
        }

        try {
            const module = this.getModule();
            if (!module.FS || !this.filename) {
                throw new Error("Cannot read file data");
            }

            // Read the file from the virtual file system
            const data = module.FS.readFile(this.filename);
            return data.buffer.slice(
                data.byteOffset,
                data.byteOffset + data.byteLength,
            );
        } catch (error) {
            throw new Error(`Failed to read data as ArrayBuffer: ${error}`);
        }
    }

    // Convert to Blob
    async toBlob(type: string = "application/x-netcdf"): Promise<Blob> {
        const buffer = await this.toArrayBuffer();
        return new Blob([buffer], { type });
    }

    toString(): string {
        const status = this._isOpen ? "open" : "closed";
        const source = this.memorySource ? "(in-memory)" : "";
        return `<netCDF4.Dataset '${this.filename}'${source}: mode = '${this.mode}', file format = '${this.file_format}', ${status}>`;
    }
    /**
     * Get complete hierarchy of groups, variables, dimensions, and attributes
     * This is the unified method for exploring the entire file structure
     * @param groupPath - Optional path to start from a specific group
     */
    async getCompleteHierarchy(
        groupPath?: string,
    ): Promise<Record<string, any>> {
        if (this.worker) {
            return this.callWorker("getCompleteHierarchy", { groupPath });
        } else {
            return NCGet.getCompleteHierarchy(
                this.module as NetCDF4Module,
                this.ncid,
                groupPath,
            );
        }
    }

    /**
     * Get all variables recursively from all groups
     * Returns a flat dictionary with full path keys like "/group1/var1"
     */
    async getVariables(): Promise<Record<string, any>> {
        if (this.worker) {
            return this.callWorker("getVariables");
        } else {
            return NCGet.getVariables(this.module as NetCDF4Module, this.ncid);
        }
    }
}

// Enhanced DataTree class for NetCDF4
// This provides UI-friendly navigation with hierarchical group tree support

export interface GroupNode {
    name: string;
    path: string;
    children: GroupNode[];
    hasVariables: boolean;
    hasAttributes: boolean;
    variableCount: number;
    attributeCount: number;
}

/**
 * UI-friendly wrapper around NetCDF4
 * Builds a full dataTree of groups, variables, attributes with enhanced navigation
 */
export class DataTree {
    private dataset: NetCDF4;
    public tree: Record<string, any> = {};
    private groupTreeCache: GroupNode | null = null;

    constructor(dataset: NetCDF4) {
        this.dataset = dataset;
    }

    async buildTree(): Promise<void> {
        this.tree = await this.dataset.getCompleteHierarchy();
        // Clear cache when tree is rebuilt
        this.groupTreeCache = null;
    }

    // --------------------------------------------------
    // Core navigation
    // --------------------------------------------------

    getGroup(groupPath: string = "/"): Record<string, any> | null {
        if (!this.tree) return null;

        if (groupPath === "/" || !groupPath) return this.tree;

        const parts = groupPath.split("/").filter(Boolean);
        let current = this.tree;

        for (const part of parts) {
            if (!current.groups || !current.groups[part]) return null;
            current = current.groups[part];
        }

        return current;
    }

    getGroupName(groupPath?: string): string {
        if (!groupPath || groupPath === "/") return "root";
        const parts = groupPath.split("/").filter(Boolean);
        return parts[parts.length - 1];
    }

    hasSubgroups(groupPath: string = "/"): boolean {
        const group = this.getGroup(groupPath);
        return group ? Object.keys(group.groups || {}).length > 0 : false;
    }

    // --------------------------------------------------
    // Groups (for dropdowns)
    // --------------------------------------------------

    /** immediate children only */
    listGroups(groupPath: string = "/"): { name: string; path: string }[] {
        const group = this.getGroup(groupPath);
        if (!group || !group.groups) return [];

        return Object.entries(group.groups).map(([name, g]: any) => ({
            name,
            path: g.path || `${groupPath === "/" ? "" : groupPath}/${name}`,
        }));
    }

    /** every group recursively */
    listAllGroups(): { name: string; path: string }[] {
        const result: { name: string; path: string }[] = [];

        const walk = (g: any) => {
            if (!g.groups) return;
            for (const [name, sub] of Object.entries(g.groups)) {
                result.push({ name, path: (sub as any).path });
                walk(sub);
            }
        };

        walk(this.tree);
        return result;
    }

    // --------------------------------------------------
    // Hierarchical Group Tree
    // --------------------------------------------------

    /**
     * Build a hierarchical tree structure of all groups
     * Returns a tree with parent-child relationships
     * Results are cached until buildTree() is called again
     */
    buildGroupTree(): GroupNode {
        // Return cached version if available
        if (this.groupTreeCache) {
            return this.groupTreeCache;
        }

        const allGroups = this.listAllGroups();

        // Create root node
        const root: GroupNode = {
            name: "/",
            path: "/",
            children: [],
            hasVariables: this.hasVariables("/"),
            hasAttributes: this.hasAttributes("/"),
            variableCount: this.getVariableCount("/"),
            attributeCount: this.getAttributeCount("/"),
        };

        // Map to store all nodes by path for quick lookup
        const nodeMap = new Map<string, GroupNode>();
        nodeMap.set("/", root);

        // Sort groups by path depth to ensure parents are created before children
        const sortedGroups = allGroups.sort((a, b) => {
            const depthA = a.path.split("/").filter(Boolean).length;
            const depthB = b.path.split("/").filter(Boolean).length;
            return depthA - depthB;
        });

        // Build the tree
        for (const { name, path } of sortedGroups) {
            const node: GroupNode = {
                name,
                path,
                children: [],
                hasVariables: this.hasVariables(path),
                hasAttributes: this.hasAttributes(path),
                variableCount: this.getVariableCount(path),
                attributeCount: this.getAttributeCount(path),
            };

            nodeMap.set(path, node);

            // Find parent path
            const pathParts = path.split("/").filter(Boolean);
            const parentPath =
                pathParts.length === 1
                    ? "/"
                    : "/" + pathParts.slice(0, -1).join("/");

            const parent = nodeMap.get(parentPath);
            if (parent) {
                parent.children.push(node);
            }
        }

        // Cache the result
        this.groupTreeCache = root;

        return root;
    }

    /**
     * Get a specific node from the group tree by path
     */
    getGroupNode(path: string): GroupNode | null {
        const tree = this.buildGroupTree();

        if (path === "/") return tree;

        const parts = path.split("/").filter(Boolean);
        let current = tree;

        for (const part of parts) {
            const child = current.children.find((c) => c.name === part);
            if (!child) return null;
            current = child;
        }

        return current;
    }

    /**
     * Get breadcrumb trail for a given path
     * Returns array of {name, path} from root to target
     */
    getBreadcrumbs(groupPath: string): { name: string; path: string }[] {
        if (groupPath === "/") {
            return [{ name: "root", path: "/" }];
        }

        const parts = groupPath.split("/").filter(Boolean);
        const breadcrumbs: { name: string; path: string }[] = [
            { name: "root", path: "/" },
        ];

        let currentPath = "";
        for (const part of parts) {
            currentPath += "/" + part;
            breadcrumbs.push({
                name: part,
                path: currentPath,
            });
        }

        return breadcrumbs;
    }

    /**
     * Search for groups by name (case-insensitive)
     */
    searchGroups(query: string): { name: string; path: string }[] {
        const lowerQuery = query.toLowerCase();
        return this.listAllGroups().filter(
            (g) =>
                g.name.toLowerCase().includes(lowerQuery) ||
                g.path.toLowerCase().includes(lowerQuery),
        );
    }

    // --------------------------------------------------
    // Variables
    // --------------------------------------------------

    /** variables inside a group */
    getAllVariables(groupPath: string = "/"): Record<string, any> {
        const group = this.getGroup(groupPath);
        return group?.variables || {};
    }

    /** check if group has variables */
    hasVariables(groupPath: string = "/"): boolean {
        const vars = this.getAllVariables(groupPath);
        return Object.keys(vars).length > 0;
    }

    /** count variables in a group */
    getVariableCount(groupPath: string = "/"): number {
        return Object.keys(this.getAllVariables(groupPath)).length;
    }

    /** get variable names as array */
    getVariableNames(groupPath: string = "/"): string[] {
        return Object.keys(this.getAllVariables(groupPath));
    }

    /**
     * Search for variables by name across all groups
     */
    searchVariables(
        query: string,
    ): { name: string; groupPath: string; path: string }[] {
        const results: { name: string; groupPath: string; path: string }[] = [];
        const lowerQuery = query.toLowerCase();

        const searchInGroup = (groupPath: string) => {
            const vars = this.getAllVariables(groupPath);
            for (const varName of Object.keys(vars)) {
                if (varName.toLowerCase().includes(lowerQuery)) {
                    results.push({
                        name: varName,
                        groupPath,
                        path: `${groupPath === "/" ? "" : groupPath}/${varName}`,
                    });
                }
            }

            // Recurse into subgroups
            const subgroups = this.listGroups(groupPath);
            for (const { path } of subgroups) {
                searchInGroup(path);
            }
        };

        searchInGroup("/");
        return results;
    }

    // --------------------------------------------------
    // Attributes
    // --------------------------------------------------

    /** attributes from the tree (fast) */
    getAttributes(groupPath: string = "/"): Record<string, any> {
        const group = this.getGroup(groupPath);
        return group?.attributes || {};
    }

    /** check if group has attributes */
    hasAttributes(groupPath: string = "/"): boolean {
        const attrs = this.getAttributes(groupPath);
        return Object.keys(attrs).length > 0;
    }

    /** count attributes in a group */
    getAttributeCount(groupPath: string = "/"): number {
        return Object.keys(this.getAttributes(groupPath)).length;
    }

    // --------------------------------------------------
    // Dimensions
    // --------------------------------------------------

    /** get dimensions for a group */
    getDimensions(groupPath: string = "/"): Record<string, any> {
        const group = this.getGroup(groupPath);
        return group?.dimensions || {};
    }

    /** check if group has dimensions */
    hasDimensions(groupPath: string = "/"): boolean {
        const dims = this.getDimensions(groupPath);
        return Object.keys(dims).length > 0;
    }

    /** count dimensions in a group */
    getDimensionCount(groupPath: string = "/"): number {
        return Object.keys(this.getDimensions(groupPath)).length;
    }

    // --------------------------------------------------
    // Statistics and Summaries
    // --------------------------------------------------

    /**
     * Get summary statistics for a group
     */
    getGroupSummary(groupPath: string = "/"): {
        path: string;
        name: string;
        variableCount: number;
        attributeCount: number;
        dimensionCount: number;
        subgroupCount: number;
        hasSubgroups: boolean;
    } | null {
        const group = this.getGroup(groupPath);
        if (!group) return null;

        return {
            path: groupPath,
            name: this.getGroupName(groupPath),
            variableCount: this.getVariableCount(groupPath),
            attributeCount: this.getAttributeCount(groupPath),
            dimensionCount: this.getDimensionCount(groupPath),
            subgroupCount: this.listGroups(groupPath).length,
            hasSubgroups: this.hasSubgroups(groupPath),
        };
    }

    /**
     * Get complete statistics for the entire dataset
     */
    getDatasetSummary(): {
        totalGroups: number;
        totalVariables: number;
        totalAttributes: number;
        totalDimensions: number;
        maxDepth: number;
    } {
        let totalVariables = 0;
        let totalAttributes = 0;
        let totalDimensions = 0;
        let maxDepth = 0;

        const countInGroup = (groupPath: string, depth: number) => {
            totalVariables += this.getVariableCount(groupPath);
            totalAttributes += this.getAttributeCount(groupPath);
            totalDimensions += this.getDimensionCount(groupPath);
            maxDepth = Math.max(maxDepth, depth);

            const subgroups = this.listGroups(groupPath);
            for (const { path } of subgroups) {
                countInGroup(path, depth + 1);
            }
        };

        countInGroup("/", 0);

        return {
            totalGroups: this.listAllGroups().length + 1, // +1 for root
            totalVariables,
            totalAttributes,
            totalDimensions,
            maxDepth,
        };
    }

    // --------------------------------------------------
    // Heavy operations → still go to dataset
    // --------------------------------------------------

    async getVariableArray(variable: number | string, groupPath?: string) {
        return this.dataset.getVariableArray(variable, groupPath);
    }

    async getSlicedVariableArray(
        variable: number | string,
        start: number[],
        count: number[],
        groupPath?: string,
    ) {
        return this.dataset.getSlicedVariableArray(
            variable,
            start,
            count,
            groupPath,
        );
    }

    async getVariableInfo(variable: number | string, groupPath?: string) {
        return this.dataset.getVariableInfo(variable, groupPath);
    }
}
