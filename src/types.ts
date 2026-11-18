// Type definitions for NetCDF4 WASM

/// <reference types="emscripten" />

import type { FILE_MODES } from "./constants.js";

// A MEMFS file node. stream_ops.read is passed HEAP8, not the Uint8Array
// that @types/emscripten declares.
export type EmscriptenFileNode = FS.FSNode & {
    usedBytes: number;
    stream_ops: Omit<FS.StreamOps, "read"> & {
        read(
            stream: FS.FSStream,
            buffer: Int8Array,
            offset: number,
            length: number,
            position: number,
        ): number;
    };
};

// FS.createFile exists at runtime but is missing from @types/emscripten
export type EmscriptenFS = typeof FS & {
    createFile(
        parent: string | FS.FSNode,
        name: string,
        properties: object,
        canRead: boolean,
        canWrite: boolean,
    ): EmscriptenFileNode;
};

// The base interface (heaps, _malloc, _free, ...) comes from @types/emscripten.
// Runtime methods are only present when listed in EXPORTED_RUNTIME_METHODS
// (see scripts/build-wasm.sh), so they have to be added here.
export interface EmscriptenModule extends globalThis.EmscriptenModule {
    ccall: typeof ccall;
    cwrap: typeof cwrap;
    getValue: typeof getValue;
    setValue: typeof setValue;
    UTF8ToString: typeof UTF8ToString;
    stringToUTF8: typeof stringToUTF8;
    lengthBytesUTF8: typeof lengthBytesUTF8;
    FS: EmscriptenFS;
    WORKERFS: Emscripten.FileSystemType;
    // Defined in bindings/post.js
    allocateString: (str: string) => number;
    freeString: (ptr: number) => void;
    ready: Promise<EmscriptenModule>;
}

export type AnyTypedArray =
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
    | string[];

export type FileMode = keyof typeof FILE_MODES;
export type CreateMode = {
    [M in FileMode]: (typeof FILE_MODES)[M]["create"] extends true ? M : never;
}[FileMode];
export type OpenMode = Exclude<FileMode, CreateMode>;
// The flags nc_open accepts
export type OpenFlags = (typeof FILE_MODES)[OpenMode]["flags"];

export interface NetCDF4WasmOptions {
    wasmPath?: string;
    memoryInitialPages?: number;
    memoryMaximumPages?: number;
}

export interface DatasetOptions extends NetCDF4WasmOptions {
    format?: string;
    diskless?: boolean;
    persist?: boolean;
    keepweakref?: boolean;
    memory?: ArrayBuffer;
}

export interface RemoteFileOptions {
    blockSize?: number;
    cacheSize?: number;
    headers?: Record<string, string>;
    withCredentials?: boolean;
    maxFullDownload?: number;
}

export interface RemoteDatasetOptions
    extends DatasetOptions,
        RemoteFileOptions {
    signal?: AbortSignal;
}

export interface MemoryDatasetSource {
    data: ArrayBuffer | Uint8Array;
    filename?: string;
}

// Union type for polymorphic Dataset constructor
export type DatasetSource = string | URL | Blob | ArrayBuffer | Uint8Array;

export interface VariableOptions {
    zlib?: boolean;
    complevel?: number;
    shuffle?: boolean;
    fletcher32?: boolean;
    contiguous?: boolean;
    chunksizes?: number[];
}
