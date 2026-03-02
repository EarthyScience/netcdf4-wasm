import { NC_CONSTANTS, DATA_TYPE_SIZE, CONSTANT_DTYPE_MAP } from './constants.js';
import type { NetCDF4Module } from './types.js';
import { DimSelection, ResolvedDim, resolveDim } from "./slice.js";

export function getGroupVariables(
    module: NetCDF4Module,
    ncid: number,
    groupPath?: string
): Record<string, any> {
    const workingNcid = groupPath ? getGroupNCID(module, ncid, groupPath) : ncid;

    const variables: Record<string, any> = {};
    const varCount = getVarCount(module, workingNcid);

    for (let varid = 0; varid < varCount; varid++) {
        const nameResult = module.nc_inq_varname(workingNcid, varid);
        if (nameResult.result !== NC_CONSTANTS.NC_NOERR || !nameResult.name) {
            console.warn(
                `Failed to get variable name for varid ${varid} (error: ${nameResult.result})`
            );
            continue;
        }
        // A coordinate variable is one whose name matches a dimension.
        const isCoordinate = findDimInHierarchy(
            module,
            workingNcid,
            nameResult.name
        );
        if (isCoordinate) continue;

        variables[nameResult.name] = {
            id: varid,
            ncid: workingNcid  // CRITICAL: Store the ncid where this variable lives!
        };
    }
    return variables;
}

export function getVarCount(
    module: NetCDF4Module,
    ncid: number
): number {    
    const result = module.nc_inq_nvars(ncid);
    if (result.result !== NC_CONSTANTS.NC_NOERR) {
        throw new Error(`Failed to get number of variables (error: ${result.result})`);
    }
    return result.nvars || 0;
}

export function getDimCount(
    module: NetCDF4Module,
    ncid: number
): number {    
    const result = module.nc_inq_ndims(ncid);
    if (result.result !== NC_CONSTANTS.NC_NOERR) {
        throw new Error(`Failed to get number of dimensions (error: ${result.result})`);
    }
    return result.ndims || 0;
}

export function getDims(
    module: NetCDF4Module,
    ncid: number,
    groupPath?: string
): Record<string, any> {
    const workingNcid = groupPath ? getGroupNCID(module, ncid, groupPath) : ncid;
    const dimIDs = getDimIDs(module, workingNcid);
    const dims: Record<string, any> = {};
    for (const dimid of dimIDs) {
        const dim = getDim(module, workingNcid, dimid)
        dims[dim.name] = {
            size: dim.len,
            units: dim.units ?? null,
            id: dim.id
        }
    }
    return dims
}

export function getDimIDs(
    module: NetCDF4Module,
    ncid: number,
    includeParents: boolean = false
): number[] | Int32Array {    
    const result = module.nc_inq_dimids(ncid, includeParents ? 1 : 0);
    if (result.result !== NC_CONSTANTS.NC_NOERR) {
        throw new Error(`Failed to get dimension IDs (error: ${result.result})`);
    }
    return result.dimids ?? [];
}

function findCoordinateVariable(
    module: NetCDF4Module,
    startNcid: number,
    name: string
): { ncid: number; varid: number } | null {

    let current: number | null = startNcid;

    while (current !== null) {
        const result = module.nc_inq_varid(current, name);
        if (result.result === NC_CONSTANTS.NC_NOERR) {
            return {
                ncid: current,
                varid: result.varid as number
            };
        }
        current = getGroupParent(module, current);
    }

    return null;
}

export function getDim(
    module: NetCDF4Module,
    ncid: number,
    dimid: number
): Record<string, any> {
    const result = module.nc_inq_dim(ncid, dimid);
    if (result.result !== NC_CONSTANTS.NC_NOERR) {
        throw new Error(`Failed to get dim (error: ${result.result})`);
    }

    const { result: _r, ...dim } = result;

    let varID: number | null = null;
    let units: any = null;
    let coordNcid: number | null = null;

    // Search upward for coordinate variable
    const coord = findCoordinateVariable(module, ncid, dim.name as string);

    if (coord) {
        varID = coord.varid;
        coordNcid = coord.ncid;
        units = getAttributeValues(module, coordNcid, varID, "units");
    }

    return {
        ...dim,
        id: varID,
        units,
        coordNcid   // useful for debugging
    };
}

export function getAttributeValues(
    module: NetCDF4Module,
    ncid: number,
    varid: number,
    attname: string
): any {
    const attInfo = module.nc_inq_att(ncid, varid, attname);
    if (attInfo.result !== NC_CONSTANTS.NC_NOERR) {
        console.warn(`Failed to get attribute info for ${attname} (error: ${attInfo.result})`);
        return null;
    }

    const attType = attInfo.type;
    if (!attType) throw new Error("Failed to allocate memory for attribute type.");

    // Dispatch table: maps NetCDF type -> module getter
    const getterMap: { [key: number]: (ncid: number, varid: number, name: string, length: number) => { result: number; data?: any } } = {
        [NC_CONSTANTS.NC_CHAR]: module.nc_get_att_text,
        [NC_CONSTANTS.NC_SHORT]: module.nc_get_att_short,
        [NC_CONSTANTS.NC_INT]: module.nc_get_att_int,
        [NC_CONSTANTS.NC_FLOAT]: module.nc_get_att_float,
        [NC_CONSTANTS.NC_DOUBLE]: module.nc_get_att_double,
        [NC_CONSTANTS.NC_BYTE]: module.nc_get_att_schar,
        [NC_CONSTANTS.NC_UBYTE]: module.nc_get_att_uchar,
        [NC_CONSTANTS.NC_UINT]: module.nc_get_att_uint,
        [NC_CONSTANTS.NC_USHORT]: module.nc_get_att_ushort,
        [NC_CONSTANTS.NC_LONGLONG]: module.nc_get_att_longlong,
        [NC_CONSTANTS.NC_UINT64]: module.nc_get_att_ulonglong,
        [NC_CONSTANTS.NC_STRING]: module.nc_get_att_string
    };

    const getter = getterMap[attType];
    if (!getter) throw new Error(`Unsupported attribute type ${attType}`);

    const attValue = getter(ncid, varid, attname, attInfo.len as number);
    return attValue.data;
}

export function getGlobalAttributes(
    module: NetCDF4Module,
    ncid: number,
    groupPath?: string
): Record<string, any> {
    const workingNcid = groupPath ? getGroupNCID(module, ncid, groupPath) : ncid;
    const attributes: Record<string, any> = {};
    const nattsResult = module.nc_inq_natts(workingNcid);
    if (nattsResult.result !== NC_CONSTANTS.NC_NOERR) {
        throw new Error(`Failed to get number of global attributes (error: ${nattsResult.result})`);
    }
    const nAtts = nattsResult.natts as number
    const attNames = []
    for (let i = 0; i < nAtts; i++) {
        const name = getAttributeName(module, workingNcid, NC_CONSTANTS.NC_GLOBAL, i)
        attNames.push(name)
    }
    if (attNames.length === 0) return attributes
    for (const attname of attNames) {
        if (!attname) continue;
        attributes[attname] = getAttributeValues(module, workingNcid, NC_CONSTANTS.NC_GLOBAL, attname)
    }
    return attributes
}

export function getAttributeName(
    module: NetCDF4Module,
    ncid: number,
    varid: number, 
    attId: number
): string | undefined {
    const result = module.nc_inq_attname(ncid, varid, attId);
    if (result.result !== NC_CONSTANTS.NC_NOERR) {
        throw new Error(`Failed to get attribute (error: ${result.result})`);
    }
    return result.name
}

export function getFullMetadata(
    module: NetCDF4Module,
    ncid: number,
    groupPath?: string
): Record<string, any>[] {
    const workingNcid = groupPath ? getGroupNCID(module, ncid, groupPath) : ncid;
    const varIds = getVarIDs(module, workingNcid)
    const metas = []
    for (const varid of varIds) {
        const varMeta = getVariableInfo(module, workingNcid, varid)
        const {attributes, ...varDeets} = varMeta
        metas.push({...varDeets, ...attributes})
    }
    return metas
}

export function getVarIDs(
    module: NetCDF4Module,
    ncid: number
): number[] | Int32Array {    
    const result = module.nc_inq_varids(ncid);
    if (result.result !== NC_CONSTANTS.NC_NOERR) {
        throw new Error(`Failed to get variable IDs (error: ${result.result})`);
    }
    return result.varids ?? [];
}

interface EnumInfo {
    name: string;
    baseType: number;
    baseSize: number;
    numMembers: number;
}

interface EnumMember {
    name: string;
    value: number | bigint;
}

interface EnumType extends EnumInfo {
    members: EnumMember[];
}

export function getEnumType(
    module: NetCDF4Module,
    ncid: number,
    xtype: number
): EnumType {
    // Get basic enum info
    const { result: infoResult, name, baseType, baseSize, numMembers } = module.nc_inq_enum(ncid, xtype);
    if (infoResult !== NC_CONSTANTS.NC_NOERR || !name || baseType === undefined || numMembers === undefined) {
        throw new Error(`Failed to get enum info (error: ${infoResult})`);
    }
    
    // Get all members
    const members: EnumMember[] = [];
    for (let i = 0; i < numMembers; i++) {
        const { result, name: memberName, value } = module.nc_inq_enum_member(
            ncid, 
            xtype, 
            i, 
            baseType
        );
        if (result === NC_CONSTANTS.NC_NOERR && memberName !== undefined && value !== undefined) {
            members.push({ name: memberName, value });
        }
    }
    
    return {
        name,
        baseType,
        baseSize: baseSize!,
        numMembers,
        members
    };
}

export function getTypeClass(
    module: NetCDF4Module,
    ncid: number,
    xtype: number
): number {
    
    // Atomic types return themselves as the class
    if (xtype < 13) { // Below NC_VLEN
        return xtype;
    }
    
    // For user-defined types, query the class
    const { result, typeClass } = module.nc_inq_user_type(ncid, xtype);
    
    if (result === NC_CONSTANTS.NC_NOERR && typeClass !== undefined) {
        return typeClass;
    }
    
    return xtype;
}

function buildEnumDict(
    module: NetCDF4Module,
    ncid: number,
    enumTypeId: number,
    enumBaseType: number
): Record<number, string> {

    const enumInqResult = module.nc_inq_enum(ncid, enumTypeId);    
    const { result: enumResult, numMembers } = enumInqResult;

    if (enumResult !== NC_CONSTANTS.NC_NOERR || numMembers === undefined) {
        throw new Error(`Failed to get enum info (error: ${enumResult})`);
    }
        
    const enumDict: Record<number, string> = {};
    for (let i = 0; i < numMembers; i++) {
        
        const memberResult = module.nc_inq_enum_member(ncid, enumTypeId, i, enumBaseType);        
        const { result: memberResultCode, name: memberName, value } = memberResult;
        
        if (memberResultCode === NC_CONSTANTS.NC_NOERR && memberName !== undefined && value !== undefined) {
            // Note: bigint values exceeding Number.MAX_SAFE_INTEGER will lose precision.
            // In practice enum values are small named constants so this is acceptable.
            const numValue = typeof value === 'bigint' ? Number(value) : value;
            enumDict[numValue] = memberName;
        } else {
            console.warn(`[buildEnumDict] Skipping member ${i}: result=${memberResultCode}, name=${memberName}, value=${value}`);
        }
    }

    return enumDict;
}

interface EnumContext {
    isEnum: boolean;
    baseType: number;
    enumDict?: Record<number, string>;
}

function resolveEnumContext(
    module: NetCDF4Module,
    ncid: number,
    varType: number
): EnumContext {
    const typeClass = getTypeClass(module, ncid, varType);

    if (typeClass === NC_CONSTANTS.NC_VLEN ||
        typeClass === NC_CONSTANTS.NC_OPAQUE ||
        typeClass === NC_CONSTANTS.NC_COMPOUND) {
        throw new Error(`Unsupported type class: ${typeClass} (VLEN, OPAQUE, and COMPOUND not yet implemented)`);
    }

    if (typeClass !== NC_CONSTANTS.NC_ENUM) {
        return { isEnum: false, baseType: varType };
    }

    const { result, baseType } = module.nc_inq_enum(ncid, varType);
    if (result !== NC_CONSTANTS.NC_NOERR || baseType === undefined) {
        throw new Error(`Failed to get enum base type (error: ${result})`);
    }

    const enumDict = buildEnumDict(module, ncid, varType, baseType);
    return { isEnum: true, baseType, enumDict };
}

function resolveVariableType(
    module: NetCDF4Module,
    ncid: number,
    varid: number
): { nctype: number; size: number; enumCtx: EnumContext } {
    const result = module.nc_inq_var(ncid, varid);
    if (result.result !== NC_CONSTANTS.NC_NOERR) {
        throw new Error(`Failed to get variable info (error: ${result.result})`);
    }

    const dimids: number[] = result.dimids ? Array.from(result.dimids) : [];
    const size = dimids.reduce((acc, dimid) => acc * getDim(module, ncid, dimid).len, 1);

    const nctype = result.type as number;
    const enumCtx = resolveEnumContext(module, ncid, nctype);

    return { nctype, size, enumCtx };
}

export function getVariableInfo(
    module: NetCDF4Module,
    ncid: number,
    variable: number | string,
    groupPath?: string
): Record<string, any> {
    const workingNcid = groupPath ? getGroupNCID(module, ncid, groupPath) : ncid;
    const info: Record<string, any> = {}
    const isId = typeof variable === "number"
    let varid = variable
    if (!isId) {
        const result = module.nc_inq_varid(workingNcid, variable)
        varid = result.varid as number
    }

    const result = module.nc_inq_var(workingNcid, varid as number);
    if (result.result !== NC_CONSTANTS.NC_NOERR) {
        throw new Error(`Failed to get variable info (error: ${result.result})`);
    }

    const varType = result.type as number;
    const enumCtx = resolveEnumContext(module, workingNcid, varType);
    const actualType = enumCtx.baseType;
    const typeMultiplier = DATA_TYPE_SIZE[actualType];

    // Dim Info
    const dimids = result.dimids
    const dims = []
    const shape = []
    const dimensions: string[] = []
    let size = 1

    if (dimids) {
        for (let i = 0; i < dimids.length; i++) {
            const dimid = dimids[i]
            const dim = getDim(module, workingNcid, dimid)
            size *= dim.len
            dims.push(dim)
            shape.push(dim.len)
            dimensions.push(dim.name)
        }
    }

    // Attribute Info
    const attNames = []
    if (result.natts) {
        for (let i = 0; i < result.natts; i++) {
            attNames.push(getAttributeName(module, workingNcid, varid as number, i))
        }
    }
    const atts: Record<string, any> = {}
    for (const attname of attNames) {
        if (!attname) continue;
        atts[attname] = getAttributeValues(module, workingNcid, varid as number, attname)
    }

    // Chunking Info
    const chunkResult = module.nc_inq_var_chunking(workingNcid, varid as number);
    const isChunked = chunkResult.chunking === NC_CONSTANTS.NC_CHUNKED
    const chunks: number[] = isChunked ? chunkResult.chunkSizes as number[] : shape
    const chunkElements = chunks.reduce((a: number, b: number) => a * b, 1)

    // Output
    info["name"]        = result.name
    info["dtype"]       = enumCtx.isEnum ? `enum(${CONSTANT_DTYPE_MAP[actualType]})` : CONSTANT_DTYPE_MAP[actualType]
    info["dtype_base"]  = CONSTANT_DTYPE_MAP[actualType]
    info["nctype"]      = varType
    info["nctype_base"] = actualType
    info["shape"]       = shape
    info["dims"]        = dims
    info["dimensions"]  = dimensions
    info["size"]        = size
    info["totalSize"]   = size * typeMultiplier
    info["attributes"]  = atts
    info["chunked"]     = isChunked
    info["chunks"]      = chunks
    info["chunkSize"]   = chunkElements * typeMultiplier

    if (enumCtx.isEnum) {
        info["enum"]     = enumCtx.enumDict
        info["enumType"] = { name: result.name, baseType: actualType }
    }

    return info;
}

// Helper function to convert enum values to names
function convertEnumValuesToNames(
    data: any,
    enumDict: Record<number, string>
): string[] {
    const enumNames: string[] = [];
    for (let i = 0; i < data.length; i++) {
        const value = data[i];
        const numValue = typeof value === 'bigint' ? Number(value) : Number(value);
        enumNames.push(enumDict[numValue] ?? `Unknown(${numValue})`);
    }
    return enumNames;
}

export function getVariableArray(
    module: NetCDF4Module,
    ncid: number,
    variable: number | string,
    groupPath?: string,
    options?: { convertEnumsToNames?: boolean }
): Int8Array | Uint8Array | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array | BigInt64Array | BigUint64Array | string[] {
    const workingNcid = groupPath ? getGroupNCID(module, ncid, groupPath) : ncid;

    let varid: number;
    if (typeof variable === "number") {
        varid = variable;
    } else {
        const result = module.nc_inq_varid(workingNcid, variable);
        if (result.result !== NC_CONSTANTS.NC_NOERR) {
            throw new Error(`Failed to get variable id for '${variable}' (error: ${result.result})`);
        }
        varid = result.varid as number;
    }

    
    const { size: arraySize, enumCtx } = resolveVariableType(module, workingNcid, varid);
    const arrayType = enumCtx.baseType;

    type VarArgs = [number, number, number];
    type VarResult = { result: number; data?: any };

    const readers: Record<number, (...args: VarArgs) => VarResult> = {
        [NC_CONSTANTS.NC_CHAR]:      (...args) => module.nc_get_var_text(...args),
        [NC_CONSTANTS.NC_BYTE]:      (...args) => module.nc_get_var_schar(...args),
        [NC_CONSTANTS.NC_UBYTE]:     (...args) => module.nc_get_var_uchar(...args),
        [NC_CONSTANTS.NC_SHORT]:     (...args) => module.nc_get_var_short(...args),
        [NC_CONSTANTS.NC_USHORT]:    (...args) => module.nc_get_var_ushort(...args),
        [NC_CONSTANTS.NC_INT]:       (...args) => module.nc_get_var_int(...args),
        [NC_CONSTANTS.NC_UINT]:      (...args) => module.nc_get_var_uint(...args),
        [NC_CONSTANTS.NC_FLOAT]:     (...args) => module.nc_get_var_float(...args),
        [NC_CONSTANTS.NC_DOUBLE]:    (...args) => module.nc_get_var_double(...args),
        [NC_CONSTANTS.NC_INT64]:     (...args) => module.nc_get_var_longlong(...args),
        [NC_CONSTANTS.NC_LONGLONG]:  (...args) => module.nc_get_var_longlong(...args),
        [NC_CONSTANTS.NC_UINT64]:    (...args) => module.nc_get_var_ulonglong(...args),
        [NC_CONSTANTS.NC_ULONGLONG]: (...args) => module.nc_get_var_ulonglong(...args),
        [NC_CONSTANTS.NC_STRING]:    (...args) => module.nc_get_var_string(...args),
    };

    let arrayData: VarResult;

    if (enumCtx.isEnum) {
        arrayData = module.nc_get_var_generic(workingNcid, varid, arraySize, arrayType);
    } else {
        const reader = readers[arrayType];
        if (!reader) {
            console.warn(`Unknown NetCDF type ${arrayType}, falling back to double`);
            arrayData = module.nc_get_var_double(workingNcid, varid, arraySize);
        } else {
            arrayData = reader(workingNcid, varid, arraySize);
        }
    }

    if (arrayData.result !== NC_CONSTANTS.NC_NOERR) {
        throw new Error(`Failed to read array data (error: ${arrayData.result})`);
    }

    if (!arrayData.data) {
        throw new Error("nc_get_var returned no data");
    }

    if (enumCtx.isEnum && options?.convertEnumsToNames && enumCtx.enumDict) {
        return convertEnumValuesToNames(arrayData.data, enumCtx.enumDict);
    }

    return arrayData.data;
}

export function getSlicedVariableArray(
    module: NetCDF4Module,
    ncid: number,
    variable: number | string,
    start: number[],
    count: number[],
    groupPath?: string,
    options?: { convertEnumsToNames?: boolean }
): Int8Array | Uint8Array | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array | BigInt64Array | BigUint64Array | string[] {
    const workingNcid = groupPath ? getGroupNCID(module, ncid, groupPath) : ncid;

    let varid: number;
    if (typeof variable === "number") {
        varid = variable;
    } else {
        const result = module.nc_inq_varid(workingNcid, variable);
        if (result.result !== NC_CONSTANTS.NC_NOERR) {
            throw new Error(`Failed to get variable id for '${variable}' (error: ${result.result})`);
        }
        varid = result.varid as number;
    }

    const { enumCtx } = resolveVariableType(module, workingNcid, varid);
    const arrayType = enumCtx.baseType; 

    type VaraArgs = [number, number, number[], number[]];
    type VaraResult = { result: number; data?: any };

    const readers: Record<number, (...args: VaraArgs) => VaraResult> = {
        [NC_CONSTANTS.NC_BYTE]:   (...args) => module.nc_get_vara_schar(...args),
        [NC_CONSTANTS.NC_UBYTE]:  (...args) => module.nc_get_vara_uchar(...args),
        [NC_CONSTANTS.NC_SHORT]:  (...args) => module.nc_get_vara_short(...args),
        [NC_CONSTANTS.NC_USHORT]: (...args) => module.nc_get_vara_ushort(...args),
        [NC_CONSTANTS.NC_INT]:    (...args) => module.nc_get_vara_int(...args),
        [NC_CONSTANTS.NC_UINT]:   (...args) => module.nc_get_vara_uint(...args),
        [NC_CONSTANTS.NC_FLOAT]:  (...args) => module.nc_get_vara_float(...args),
        [NC_CONSTANTS.NC_DOUBLE]: (...args) => module.nc_get_vara_double(...args),
        [NC_CONSTANTS.NC_INT64]:  (...args) => module.nc_get_vara_longlong(...args),
        [NC_CONSTANTS.NC_UINT64]: (...args) => module.nc_get_vara_ulonglong(...args),
        [NC_CONSTANTS.NC_STRING]: (...args) => module.nc_get_vara_string(...args),
    };

    let arrayData: VaraResult;

    if (enumCtx.isEnum) {
        arrayData = module.nc_get_vara_generic(workingNcid, varid, start, count, arrayType);
    } else {
        const reader = readers[arrayType];
        if (!reader) {
            console.warn(`Unknown NetCDF type ${arrayType}, falling back to double`);
            arrayData = module.nc_get_vara_double(workingNcid, varid, start, count);
        } else {
            arrayData = reader(workingNcid, varid, start, count);
        }
    }

    if (arrayData.result !== NC_CONSTANTS.NC_NOERR) {
        throw new Error(`Failed to read sliced array data (error: ${arrayData.result})`);
    }

    if (!arrayData.data) {
        throw new Error("nc_get_vara returned no data");
    }

    if (enumCtx.isEnum && options?.convertEnumsToNames && enumCtx.enumDict) {
        return convertEnumValuesToNames(arrayData.data, enumCtx.enumDict);
    }

    return arrayData.data;
}

type AnyTypedArray =
    | Int8Array    | Uint8Array
    | Int16Array   | Uint16Array
    | Int32Array   | Uint32Array
    | Float32Array | Float64Array
    | BigInt64Array | BigUint64Array
    | string[];

export function getVariableArrayWithSelection(
    module: NetCDF4Module,
    ncid: number,
    variable: number | string,
    selection: DimSelection[],
    groupPath?: string,
    options?: { convertEnumsToNames?: boolean }
): AnyTypedArray {
    const workingNcid = groupPath ? getGroupNCID(module, ncid, groupPath) : ncid;

    // Resolve varid
    let varid: number;
    if (typeof variable === "number") {
        varid = variable;
    } else {
        const r = module.nc_inq_varid(workingNcid, variable);
        if (r.result !== NC_CONSTANTS.NC_NOERR) {
            throw new Error(`Failed to get variable id for '${variable}' (error: ${r.result})`);
        }
        varid = r.varid as number;
    }

    // Query variable dimensions — use workingNcid throughout
    const varInfo = module.nc_inq_var(workingNcid, varid);
    if (varInfo.result !== NC_CONSTANTS.NC_NOERR) {
        throw new Error(`Failed to query variable info (error: ${varInfo.result})`);
    }

    const dimids: number[] = Array.from(varInfo.dimids ?? []);
    const ndim = dimids.length;

    if (selection.length !== ndim) {
        throw new Error(
            `Selection has ${selection.length} dimension(s) but variable has ${ndim}`
        );
    }

    // Fetch each dimension's size — resolveDim handles BigInt safely
    const dimSizes = dimids.map((dimid: number) => {
        const r = module.nc_inq_dimlen(workingNcid, dimid);
        if (r.result !== NC_CONSTANTS.NC_NOERR) {
            throw new Error(`Failed to query dim length for dimid ${dimid} (error: ${r.result})`);
        }
        return r.len as number | bigint;
    });

    // Resolve each selection — resolveDim coerces BigInt internally
    const resolved: ResolvedDim[] = selection.map((sel, i) =>
        resolveDim(sel, dimSizes[i])
    );

    const start  = resolved.map(d => d.start);
    const count  = resolved.map(d => d.count);
    const stride = resolved.map(d => Math.abs(d.step));

    const hasNegativeStep = resolved.some(d => d.step < 0);


    // Validate parameters against dimension sizes
    for (let i = 0; i < start.length; i++) {
        const dimSize = Number(dimSizes[i]);
        if (start[i] < 0 || start[i] >= dimSize) {
            throw new Error(
                `Invalid start[${i}] = ${start[i]} for dimension size ${dimSize}`
            );
        }
        if (count[i] <= 0) {
            throw new Error(
                `Invalid count[${i}] = ${count[i]} (must be > 0)`
            );
        }
        const lastIdx = start[i] + (count[i] - 1) * stride[i];
        if (lastIdx >= dimSize) {
            throw new Error(
                `Stride read would exceed dimension bounds: start[${i}]=${start[i]}, ` +
                `count[${i}]=${count[i]}, stride[${i}]=${stride[i]}, last_idx=${lastIdx}, dimSize=${dimSize}`
            );
        }
    }

    // Resolve variable type — use workingNcid so enum lookup is in the right group
    const { enumCtx } = resolveVariableType(module, workingNcid, varid);
    const arrayType = enumCtx.baseType;

    let arrayData: { result: number; data?: any };

    // Read data
    // Always use nc_get_vars_* (strided) — nc_get_vara has marshalling issues
    // with null/all selections. When stride is all-1s the netCDF-C library takes
    // the same fast contiguous path internally, so there is no performance cost.
    console.log('vars read', { start, count, stride, dimSizes: dimSizes.map(Number), arrayType, hasNegativeStep });

    if (enumCtx.isEnum) {
        arrayData = module.nc_get_vars_generic(workingNcid, varid, start, count, stride, arrayType);
    } else {
        type VarsArgs = [number, number, number[], number[], number[]];
        type VarsResult = { result: number; data?: any };

        const readers: Record<number, (...args: VarsArgs) => VarsResult> = {
            [NC_CONSTANTS.NC_BYTE]:      (...args) => module.nc_get_vars_schar(...args),
            [NC_CONSTANTS.NC_UBYTE]:     (...args) => module.nc_get_vars_uchar(...args),
            [NC_CONSTANTS.NC_SHORT]:     (...args) => module.nc_get_vars_short(...args),
            [NC_CONSTANTS.NC_USHORT]:    (...args) => module.nc_get_vars_ushort(...args),
            [NC_CONSTANTS.NC_INT]:       (...args) => module.nc_get_vars_int(...args),
            [NC_CONSTANTS.NC_UINT]:      (...args) => module.nc_get_vars_uint(...args),
            [NC_CONSTANTS.NC_FLOAT]:     (...args) => module.nc_get_vars_float(...args),
            [NC_CONSTANTS.NC_DOUBLE]:    (...args) => module.nc_get_vars_double(...args),
            [NC_CONSTANTS.NC_INT64]:     (...args) => module.nc_get_vars_longlong(...args),
            [NC_CONSTANTS.NC_LONGLONG]:  (...args) => module.nc_get_vars_longlong(...args),
            [NC_CONSTANTS.NC_UINT64]:    (...args) => module.nc_get_vars_ulonglong(...args),
            [NC_CONSTANTS.NC_ULONGLONG]: (...args) => module.nc_get_vars_ulonglong(...args),
            [NC_CONSTANTS.NC_STRING]:    (...args) => module.nc_get_vars_string(...args),
        };

        const reader = readers[arrayType];
        if (!reader) {
            console.warn(`Unknown NetCDF type ${arrayType}, falling back to double`);
            arrayData = module.nc_get_vars_double(workingNcid, varid, start, count, stride);
        } else {
            arrayData = reader(workingNcid, varid, start, count, stride);
        }
    }

    if (arrayData.result !== NC_CONSTANTS.NC_NOERR) {
        throw new Error(`Failed to read array data (error: ${arrayData.result})`);
    }
    if (!arrayData.data) {
        throw new Error("nc_get_vars returned no data");
    }

    let result: AnyTypedArray = arrayData.data;

    if (enumCtx.isEnum && options?.convertEnumsToNames && enumCtx.enumDict) {
        result = convertEnumValuesToNames(result, enumCtx.enumDict);
    }

    // Reverse dimensions that had a negative step — cheap, operates on already-small output
    if (hasNegativeStep) {
        result = applyNegativeStepReversal(result, resolved);
    }

    return result;
}

// applyNegativeStepReversal

function applyNegativeStepReversal<T extends AnyTypedArray>(
    data: T,
    resolved: ResolvedDim[]
): T {
    const ndim = resolved.length;
    const outCount = resolved.map(d => d.collapsed ? 1 : d.count);
    const totalOut = outCount.reduce((a, b) => a * b, 1);

    const outStrides = new Array<number>(ndim);
    outStrides[ndim - 1] = 1;
    for (let i = ndim - 2; i >= 0; i--) {
        outStrides[i] = outStrides[i + 1] * outCount[i + 1];
    }

    const out: AnyTypedArray = Array.isArray(data)
        ? new Array<string>(totalOut)
        : new (data.constructor as any)(totalOut);

    for (let outIdx = 0; outIdx < totalOut; outIdx++) {
        let rem    = outIdx;
        let srcIdx = 0;
        for (let d = 0; d < ndim; d++) {
            const logI = Math.floor(rem / outStrides[d]);
            rem -= logI * outStrides[d];
            const srcI = resolved[d].step < 0 ? outCount[d] - 1 - logI : logI;
            srcIdx += srcI * outStrides[d];
        }
        (out as any)[outIdx] = (data as any)[srcIdx];
    }

    return out as T;
}

//---- Group Functions ----//

/**
 * Get group ncid by path (supports nested groups)
 * Uses nc_inq_grp_full_ncid for absolute paths and manual traversal for relative paths
 * @param module - NetCDF4 module
 * @param ncid - Current ncid (can be root or any group)
 * @param groupPath - Can be absolute ("/group1/subgroup") or relative ("subgroup" or "group1/subgroup")
 * @returns The ncid of the requested group
 */
export function getGroupNCID(
    module: NetCDF4Module,
    ncid: number,
    groupPath: string
): number {
    // Optimization: if path is root, return the ncid
    if (groupPath === '/' || groupPath === '') {
        return ncid;
    }
    
    // Try using nc_inq_grp_full_ncid for absolute paths (more efficient)
    if (groupPath.startsWith('/')) {
        const result = module.nc_inq_grp_full_ncid(ncid, groupPath);
        if (result.result === NC_CONSTANTS.NC_NOERR) {
            return result.grp_ncid as number;
        }
        
        // Get current path for better error message
        const currentPath = getGroupPath(module, ncid);
        throw new Error(
            `Failed to find group '${groupPath}' from '${currentPath}' (error: ${result.result})`
        );
    }
    
    // Manual traversal for relative paths
    const parts = groupPath.split('/').filter(p => p.length > 0);
    let currentNcid = ncid;
    
    for (const part of parts) {
        const result = module.nc_inq_grp_ncid(currentNcid, part);
        if (result.result !== NC_CONSTANTS.NC_NOERR) {
            const currentPath = getGroupPath(module, currentNcid);
            throw new Error(
                `Failed to get group ncid for '${part}' in path '${groupPath}' from '${currentPath}' (error: ${result.result})`
            );
        }
        currentNcid = result.grp_ncid as number;
    }
    
    return currentNcid;
}

/**
 * Alias for getGroupNCID (matches nc_inq_ncid API)
 * @param module - NetCDF4 module
 * @param ncid - Current ncid
 * @param groupName - Group name or path
 * @returns The ncid of the requested group
 */
export const getNCID = getGroupNCID;

/**
 * Get immediate child groups (non-recursive)
 * @param module - NetCDF4 module
 * @param ncid - Group ncid to query
 * @returns Object mapping group names to their ncids
 */
export function getGroups(
    module: NetCDF4Module,
    ncid: number
): Record<string, number> {
    const result = module.nc_inq_grps(ncid);
    if (result.result !== NC_CONSTANTS.NC_NOERR) {
        throw new Error(`Failed to get groups (error: ${result.result})`);
    }
    
    const groups: Record<string, number> = {};
    const grpids = result.grpids || [];
    
    for (const grpid of grpids) {
        const nameResult = module.nc_inq_grpname(grpid);
        if (nameResult.result === NC_CONSTANTS.NC_NOERR && nameResult.name) {
            groups[nameResult.name] = grpid;
        }
    }
    
    return groups;
}

/**
 * Get all groups recursively (returns nested structure)
 * @param module - NetCDF4 module
 * @param ncid - Group ncid to start from (usually root)
 * @returns Nested object structure with group names, ncids, and subgroups
 */
export function getGroupsRecursive(
    module: NetCDF4Module,
    ncid: number
): Record<string, any> {
    const result = module.nc_inq_grps(ncid);
    if (result.result !== NC_CONSTANTS.NC_NOERR) {
        throw new Error(`Failed to get groups (error: ${result.result})`);
    }
    
    const groups: Record<string, any> = {};
    const grpids = result.grpids || [];
    
    for (const grpid of grpids) {
        const nameResult = module.nc_inq_grpname(grpid);
        if (nameResult.result === NC_CONSTANTS.NC_NOERR && nameResult.name) {
            groups[nameResult.name] = {
                ncid: grpid,
                subgroups: getGroupsRecursive(module, grpid) // Recursive call
            };
        }
    }
    
    return groups;
}

/**
 * Get the name of a group
 * @param module - NetCDF4 module
 * @param ncid - Group ncid
 * @returns Group name
 */
export function getGroupName(
    module: NetCDF4Module,
    ncid: number
): string {
    const result = module.nc_inq_grpname(ncid);
    if (result.result !== NC_CONSTANTS.NC_NOERR) {
        throw new Error(`Failed to get group name (error: ${result.result})`);
    }
    return result.name || '';
}

/**
 * Get the full absolute path of a group
 * Uses nc_inq_grpname_full for efficient path retrieval
 * @param module - NetCDF4 module
 * @param ncid - Group ncid
 * @returns Full path like "/group1/subgroup"
 */
export function getGroupPath(
    module: NetCDF4Module,
    ncid: number
): string {
    // Use nc_inq_grpname_full to get the complete path efficiently
    const result = module.nc_inq_grpname_full(ncid);
    if (result.result !== NC_CONSTANTS.NC_NOERR) {
        throw new Error(`Failed to get group full name (error: ${result.result})`);
    }
    
    return result.full_name || '/';
}

/**
 * Get the length of a group's full path name
 * @param module - NetCDF4 module
 * @param ncid - Group ncid
 * @returns Length of the full group path name
 */
export function getGroupPathLength(
    module: NetCDF4Module,
    ncid: number
): number {
    const result = module.nc_inq_grpname_len(ncid);
    if (result.result !== NC_CONSTANTS.NC_NOERR) {
        throw new Error(`Failed to get group name length (error: ${result.result})`);
    }
    return result.lenp || 0;
}

/**
 * Get the parent group ncid
 * @param module - NetCDF4 module
 * @param ncid - Group ncid
 * @returns Parent group ncid, or null if this is the root group
 */
export function getGroupParent(
    module: NetCDF4Module,
    ncid: number
): number | null {
    const result = module.nc_inq_grp_parent(ncid);
    if (result.result !== NC_CONSTANTS.NC_NOERR) {
        return null; // No parent (at root)
    }
    return result.parent_ncid as number;
}
function findDimInHierarchy(
    module: NetCDF4Module,
    startNcid: number,
    name: string
): boolean {

    let current: number | null = startNcid;

    while (current !== null) {
        const result = module.nc_inq_dimid(current, name);
        if (result.result === NC_CONSTANTS.NC_NOERR) {
            return true;
        }
        current = getGroupParent(module, current);
    }

    return false;
}

/**
 * Get complete hierarchy: groups + their variables, dimensions, and attributes recursively
 * This is the unified method that should be used for exploring the file structure
 * @param module - NetCDF4 module
 * @param ncid - Group ncid to start from
 * @param groupPath - Optional path to a specific starting group
 * @param includeParentDims - Whether to include parent dimensions in each group (default: false)
 * @returns Complete hierarchical structure
 */
export function getCompleteHierarchy(
    module: NetCDF4Module,
    ncid: number,
    groupPath?: string,
    includeParentDims: boolean = false
): Record<string, any> {
    const workingNcid = groupPath ? getGroupNCID(module, ncid, groupPath) : ncid;
    
    // Get variables at this level (now includes ncid)
    const variables = getGroupVariables(module, workingNcid);
    
    // Get dimensions at this level
    const dimensions = getDims(module, workingNcid);
    
    // If includeParentDims is true, also get parent dimensions
    if (includeParentDims) {
        const result = module.nc_inq_dimids(workingNcid, 1);
        if (result.result === NC_CONSTANTS.NC_NOERR && result.dimids) {
            const parentDims: Record<string, any> = {};
            for (const dimid of result.dimids) {
                const dim = getDim(module, workingNcid, dimid);
                // Only add if not already in dimensions (avoid duplicates)
                if (!dimensions[dim.name]) {
                    parentDims[dim.name] = {
                        size: dim.len,
                        units: dim.units ?? null,
                        id: dim.id,
                        inherited: true
                    };
                }
            }
            // Merge parent dimensions
            Object.assign(dimensions, parentDims);
        }
    }
    
    // Get attributes at this level
    const attributes = getGlobalAttributes(module, workingNcid);
    
    // Get the full path for this group
    const fullPath = getGroupPath(module, workingNcid);
    
    // Get subgroups and recurse
    const groupsResult = module.nc_inq_grps(workingNcid);
    const subgroups: Record<string, any> = {};
    
    if (groupsResult.result === NC_CONSTANTS.NC_NOERR && groupsResult.grpids) {
        for (const grpid of groupsResult.grpids) {
            const nameResult = module.nc_inq_grpname(grpid);
            if (nameResult.result === NC_CONSTANTS.NC_NOERR && nameResult.name) {
                // Recursively get the complete hierarchy for this subgroup
                subgroups[nameResult.name] = getCompleteHierarchy(
                    module, 
                    grpid, 
                    undefined, 
                    includeParentDims
                );
            }
        }
    }
    
    return {
        ncid: workingNcid,  // Include the ncid at this level
        path: fullPath,      // Include the full path
        variables,
        dimensions,
        attributes,
        groups: subgroups
    };
}

/**
 * Get all variables recursively from all groups
 * Returns a flat structure with full paths as keys
 * @param module - NetCDF4 module
 * @param ncid - Group ncid to start from
 * @param currentPath - Current path (used internally for recursion)
 * @returns Flat dictionary with full variable paths
 */
export function getVariables(
    module: NetCDF4Module,
    ncid: number,
    currentPath?: string
): Record<string, any> {
    const allVars: Record<string, any> = {};
    
    // Get the actual path if not provided
    const path = currentPath || getGroupPath(module, ncid);
    
    // Get variables at current level
    const vars = getGroupVariables(module, ncid);
    for (const [name, varData] of Object.entries(vars)) {
        const fullPath = path === '/' ? name : `${path}/${name}`;
        allVars[fullPath] = { ...varData, path, ncid };
    }
    
    // Recurse into subgroups
    const groupsResult = module.nc_inq_grps(ncid);
    if (groupsResult.result === NC_CONSTANTS.NC_NOERR && groupsResult.grpids) {
        for (const grpid of groupsResult.grpids) {
            const nameResult = module.nc_inq_grpname(grpid);
            if (nameResult.result === NC_CONSTANTS.NC_NOERR && nameResult.name) {
                const newPath = path === '/' ? nameResult.name : `${path}/${nameResult.name}`;
                const subVars = getVariables(module, grpid, newPath);
                Object.assign(allVars, subVars);
            }
        }
    }
    
    return allVars;
}