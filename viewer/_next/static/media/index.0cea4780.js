// NetCDF4 WASM - Main entry point
// JavaScript API modeled on netcdf4-python for familiarity
export { DATA_TYPE_MAP, NC_CONSTANTS } from "./constants.js";
export { Dimension } from "./dimension.js";
export { Group } from "./group.js";
// Export all classes and types
// Re-export NetCDF4 as default for backwards compatibility
export { DataTree, NetCDF4, NetCDF4 as default } from "./netcdf4.js";
export { all, isAll, resolveDim, Slice, slice } from "./slice.js";
export { Variable } from "./variable.js";
// Polymorphic Dataset constructor - accepts filename, URL, Blob, ArrayBuffer, or Uint8Array
import { NetCDF4 } from "./netcdf4.js";
export async function Dataset(source, mode = "r", options = {}) {
    // Type detection and routing
    if (typeof source === "string" || source instanceof URL) {
        // File path, or http(s) URL read lazily over Range requests
        return await NetCDF4.Dataset(source, mode, options);
    }
    else if (source instanceof Blob) {
        // Blob object
        return await NetCDF4.fromBlob(source, mode, options);
    }
    else if (source instanceof ArrayBuffer) {
        // ArrayBuffer
        return await NetCDF4.fromArrayBuffer(source, mode, options);
    }
    else if (source instanceof Uint8Array) {
        // Uint8Array
        return await NetCDF4.fromMemory(source, mode, options);
    }
    else {
        throw new Error("Invalid source type. Expected string, URL, Blob, ArrayBuffer, or Uint8Array.");
    }
}
// Legacy convenience functions for backward compatibility
export async function DatasetFromBlob(blob, mode = "r", options = {}) {
    return await Dataset(blob, mode, options);
}
export async function DatasetFromArrayBuffer(buffer, mode = "r", options = {}) {
    return await Dataset(buffer, mode, options);
}
export async function DatasetFromMemory(data, mode = "r", options = {}, filename) {
    if (filename) {
        return await NetCDF4.fromMemory(data, mode, options, filename);
    }
    return await Dataset(data, mode, options);
}
//# sourceMappingURL=index.js.map