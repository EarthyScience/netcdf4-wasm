import { toError } from "./errors.js";
import { isOperationName, runOperation } from "./operations.js";
import { checkRangeSupport, createRemoteFileNode, RemoteFile, XhrRangeSource, } from "./remote-read.js";
import { WasmModuleLoader } from "./wasm-module.js";
let netcdfModule;
let mod;
let remoteFile;
// Wait for runtime initialization.
// An async IIFE (rather than `new Promise(async ...)`) so that a failed
// import or WASM load rejects this promise instead of leaving it pending.
const waitForModule = (async () => {
    const netcdf4Module = await import("./netcdf4-wasm.js");
    const createNetCDF4Module = netcdf4Module.default;
    netcdfModule = await createNetCDF4Module({
        locateFile: (file) => {
            if (file.endsWith(".wasm")) {
                const origin = self.location.origin;
                const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
                return `${origin}${basePath}/${file}`;
            }
            return file;
        },
    });
    return netcdfModule;
})();
self.onmessage = async (e) => {
    const data = e.data;
    const { type, id } = data;
    try {
        // ---------------- INIT ----------------
        if (type === "init") {
            mod = WasmModuleLoader.wrapModule(await waitForModule);
            const { blob, url, remote, filename } = data;
            if (url) {
                await checkRangeSupport(url, remote);
                remoteFile = new RemoteFile(new XhrRangeSource(url, remote), remote);
                createRemoteFileNode(mod.FS, filename, remoteFile);
                self.postMessage({ id, success: true });
                return;
            }
            const pathParts = filename.split("/");
            const baseName = pathParts.pop();
            const mountPoint = pathParts.join("/") || "/";
            // safer for nested paths
            try {
                mod.FS.mkdirTree(mountPoint);
            }
            catch (_) { }
            try {
                mod.FS.mount(mod.WORKERFS, {
                    blobs: [{ name: baseName, data: blob }],
                }, mountPoint);
            }
            catch (err) {
                console.warn("Mount failed (might already be mounted):", toError(err).message);
            }
            self.postMessage({ id, success: true });
            return;
        }
        // ------------- ENSURE READY -------------
        if (!mod) {
            mod = WasmModuleLoader.wrapModule(await waitForModule);
        }
        // Only report read errors raised by this request
        if (remoteFile)
            remoteFile.lastError = undefined;
        if (!isOperationName(type)) {
            throw new Error(`Unknown message type: ${type}`);
        }
        const result = runOperation(mod, type, data.args);
        self.postMessage({ id, success: true, result });
    }
    catch (err) {
        // netCDF-C only sees EIO for a failed remote read; attach the actual cause
        let message = toError(err).message;
        if (remoteFile?.lastError) {
            message += ` (${remoteFile.lastError.message})`;
        }
        console.error(`Worker Error [${type}]:`, err);
        self.postMessage({ id, success: false, error: message });
    }
};
//# sourceMappingURL=netcdf-worker.js.map