// Every operation a dataset can run on its WASM module, defined once.
// NetCDF4 calls them directly on the main thread and sends them by name to
// netcdf-worker otherwise, so both paths run the same code.

import { NC_CONSTANTS } from "./constants.js";
import * as NCGet from "./netcdf-getters.js";
import type { DimSelection } from "./slice.js";
import type { OpenFlags } from "./types.js";
import type { NetCDF4Module } from "./wasm-module.js";

// Arguments of an operation: the ncid it runs on, plus its own
type Args<T = object> = { ncid: number } & T;
type GroupArgs = Args<{ groupPath?: string }>;
type VariableArgs = Args<{ variable: number | string; groupPath?: string }>;

export const operations = {
    open: (
        module: NetCDF4Module,
        { path, modeValue }: Args<{ path: string; modeValue: OpenFlags }>,
    ) => {
        const result = module.nc_open(path, modeValue);
        if (result.result !== NC_CONSTANTS.NC_NOERR) {
            throw new Error(
                `Failed to open NetCDF file: ${path} (error: ${result.result})`,
            );
        }
        return result.ncid;
    },

    close: (module: NetCDF4Module, { ncid }: Args) => {
        const result = module.nc_close(ncid);
        if (result !== NC_CONSTANTS.NC_NOERR) {
            throw new Error(
                `Failed to close NetCDF file with ID: ${ncid} (error: ${result})`,
            );
        }
    },

    // ---- Globals ----
    getGlobalAttributes: (module: NetCDF4Module, a: GroupArgs) =>
        NCGet.getGlobalAttributes(module, a.ncid, a.groupPath),

    getFullMetadata: (module: NetCDF4Module, a: GroupArgs) =>
        NCGet.getFullMetadata(module, a.ncid, a.groupPath),

    // ---- Dims ----
    getDimCount: (module: NetCDF4Module, a: Args) =>
        NCGet.getDimCount(module, a.ncid),

    getDimIDs: (module: NetCDF4Module, a: Args) =>
        NCGet.getDimIDs(module, a.ncid),

    getDim: (module: NetCDF4Module, a: Args<{ dimid: number }>) =>
        NCGet.getDim(module, a.ncid, a.dimid),

    getDims: (module: NetCDF4Module, a: GroupArgs) =>
        NCGet.getDims(module, a.ncid, a.groupPath),

    // ---- Vars ----
    getGroupVariables: (module: NetCDF4Module, a: GroupArgs) =>
        NCGet.getGroupVariables(module, a.ncid, a.groupPath),

    getVarIDs: (module: NetCDF4Module, a: Args) =>
        NCGet.getVarIDs(module, a.ncid),

    getVarCount: (module: NetCDF4Module, a: Args) =>
        NCGet.getVarCount(module, a.ncid),

    getAttributeName: (
        module: NetCDF4Module,
        a: Args<{ varid: number; attId: number }>,
    ) => NCGet.getAttributeName(module, a.ncid, a.varid, a.attId),

    getAttributeValues: (
        module: NetCDF4Module,
        a: Args<{ varid: number; attname: string }>,
    ) => NCGet.getAttributeValues(module, a.ncid, a.varid, a.attname),

    getVariableInfo: (module: NetCDF4Module, a: VariableArgs) =>
        NCGet.getVariableInfo(module, a.ncid, a.variable, a.groupPath),

    // ---- Arrays ----
    getVariableArray: (module: NetCDF4Module, a: VariableArgs) =>
        NCGet.getVariableArray(module, a.ncid, a.variable, a.groupPath),

    getSlicedVariableArray: (
        module: NetCDF4Module,
        a: VariableArgs & { start: number[]; count: number[] },
    ) =>
        NCGet.getSlicedVariableArray(
            module,
            a.ncid,
            a.variable,
            a.start,
            a.count,
            a.groupPath,
        ),

    getVariableArrayWithSelection: (
        module: NetCDF4Module,
        a: VariableArgs & {
            selection: DimSelection[];
            options?: { convertEnumsToNames?: boolean };
        },
    ) =>
        NCGet.getVariableArrayWithSelection(
            module,
            a.ncid,
            a.variable,
            a.selection,
            a.groupPath,
            a.options,
        ),

    // ---- Groups ----
    getGroups: (module: NetCDF4Module, a: Args) =>
        NCGet.getGroups(module, a.ncid),

    getGroupsRecursive: (module: NetCDF4Module, a: Args) =>
        NCGet.getGroupsRecursive(module, a.ncid),

    getGroupNCID: (module: NetCDF4Module, a: Args<{ groupPath: string }>) =>
        NCGet.getGroupNCID(module, a.ncid, a.groupPath),

    getGroupName: (module: NetCDF4Module, a: Args) =>
        NCGet.getGroupName(module, a.ncid),

    getGroupPath: (module: NetCDF4Module, a: Args) =>
        NCGet.getGroupPath(module, a.ncid),

    getCompleteHierarchy: (module: NetCDF4Module, a: GroupArgs) =>
        NCGet.getCompleteHierarchy(module, a.ncid, a.groupPath),

    getVariables: (module: NetCDF4Module, a: Args) =>
        NCGet.getVariables(module, a.ncid),
};

export type OperationName = keyof typeof operations;
export type OperationArgs<K extends OperationName> = Parameters<
    (typeof operations)[K]
>[1];
export type OperationResult<K extends OperationName> = ReturnType<
    (typeof operations)[K]
>;

export function isOperationName(name: unknown): name is OperationName {
    return typeof name === "string" && Object.hasOwn(operations, name);
}

// Run an operation by name. The cast is needed because TypeScript cannot
// relate the arguments of operations[name] to a generic name.
export function runOperation<K extends OperationName>(
    module: NetCDF4Module,
    name: K,
    args: OperationArgs<K>,
): OperationResult<K> {
    const operation = operations[name] as (
        module: NetCDF4Module,
        args: OperationArgs<K>,
    ) => OperationResult<K>;
    return operation(module, args);
}
