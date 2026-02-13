import { NC_CONSTANTS, DATA_TYPE_SIZE, CONSTANT_DTYPE_MAP } from './constants.js';
import type { NetCDF4Module } from './types.js';

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
    const typeMultiplier = DATA_TYPE_SIZE[result.type as number]

    //Dim Info
    const dimids = result.dimids
    const dims = []
    const shape = []
    let size = 1
    if (dimids) {
        for (const dimid of dimids) {
            const dim = getDim(module, workingNcid, dimid)
            size *= dim.len
            dims.push(dim)
            shape.push(dim.len)
        }
    }
    
    //Attribute Info
    const attNames = []
    if (result.natts) {
        for (let i = 0; i < result.natts; i++) {
            const attname = getAttributeName(module, workingNcid, varid as number, i)
            attNames.push(attname)
        } 
    }
    const atts: Record<string, any> = {}
    if (attNames.length > 0) {
        for (const attname of attNames) {
            if (!attname) continue;
            atts[attname] = getAttributeValues(module, workingNcid, varid as number, attname)
        }
    }

    //Chunking Info
    let chunks: number[];
    const chunkResult = module.nc_inq_var_chunking(workingNcid, varid as number);
    const isChunked = chunkResult.chunking === NC_CONSTANTS.NC_CHUNKED
    if (isChunked) {
        chunks = chunkResult.chunkSizes as number[]
    } else {
        chunks = shape
    }
    const chunkElements = chunks.reduce((a: number, b: number) => a * b, 1)

    //Output 
    info["name"] = result.name
    info["dtype"] = CONSTANT_DTYPE_MAP[result.type as number]
    info['nctype'] = result.type
    info["shape"] = shape
    info['dims'] = dims
    info["size"] = size
    info["totalSize"] = size * typeMultiplier
    info["attributes"] = atts
    info["chunked"] = isChunked
    info["chunks"] = chunks
    info["chunkSize"] = chunkElements * typeMultiplier
    
    return info;
}

export function getVariableArray(
    module: NetCDF4Module,
    ncid: number,
    variable: number | string,
    groupPath?: string
): Float32Array | Float64Array | Int16Array | Int32Array | BigInt64Array | BigInt[] | string[] {
    const workingNcid = groupPath ? getGroupNCID(module, ncid, groupPath) : ncid;
    
    // console.log('=== getVariableArray DEBUG ===');
    // console.log('Input ncid:', ncid);
    // console.log('Working ncid:', workingNcid);
    // console.log('Variable:', variable);
    // console.log('Group path:', groupPath);
    
    const isId = typeof variable === "number"
    let varid = isId ? variable as number : 0
    if (!isId) {
        const result = module.nc_inq_varid(workingNcid, variable)
        varid = result.varid as number
    }
    // console.log('Using varid:', varid);    
    const info = getVariableInfo(module, workingNcid, varid)
    // console.log('Variable info:', info);
    
    const arraySize = info.size
    const arrayType = info.nctype
    
    // console.log(`Array size: ${arraySize}, type: ${arrayType} (${info.dtype})`);
    // console.log(`Shape: [${info.shape.join(', ')}]`);
    // console.log(`Byte size: ${arraySize * DATA_TYPE_SIZE[arrayType]} bytes`);
    if (!arrayType || !arraySize) throw new Error("Failed to allocate memory for array")
    let arrayData;
    if (arrayType === 2) arrayData = module.nc_get_var_text(workingNcid, varid, arraySize);
    else if (arrayType === 3) arrayData = module.nc_get_var_short(workingNcid, varid, arraySize);
    else if (arrayType === 4) arrayData = module.nc_get_var_int(workingNcid, varid, arraySize);
    else if (arrayType === 10) arrayData = module.nc_get_var_longlong(workingNcid, varid, arraySize);
    else if (arrayType === 5) arrayData = module.nc_get_var_float(workingNcid, varid, arraySize);
    else if (arrayType === 6) arrayData = module.nc_get_var_double(workingNcid, varid, arraySize);
    else arrayData = module.nc_get_var_double(workingNcid, varid, arraySize);
    if (!arrayData.data) {
        throw new Error("nc_get_var returned no data")
    }
    return arrayData.data
}

export function getSlicedVariableArray(
    module: NetCDF4Module,
    ncid: number,
    variable: number | string, 
    start: number[], 
    count: number[],
    groupPath?: string
): Float32Array | Float64Array | Int16Array | Int32Array | BigInt64Array | BigInt[] | string[] {
    const workingNcid = groupPath ? getGroupNCID(module, ncid, groupPath) : ncid;
    const isId = typeof variable === "number"
    let varid = isId ? variable as number : 0
    if (!isId) {
        const result = module.nc_inq_varid(workingNcid, variable)
        if (result.result !== NC_CONSTANTS.NC_NOERR) {
            throw new Error(`Failed to get variable id for '${variable}' (error: ${result.result})`);
        }
        varid = result.varid as number
    }
    
    const info = getVariableInfo(module, workingNcid, varid)
    const arrayType = info.nctype
    if (!arrayType) throw new Error("Failed to allocate memory for array")
    let arrayData;
    if (arrayType === 3) arrayData = module.nc_get_vara_short(workingNcid, varid, start, count);
    else if (arrayType === 4) arrayData = module.nc_get_vara_int(workingNcid, varid, start, count);
    else if (arrayType === 5) arrayData = module.nc_get_vara_float(workingNcid, varid, start, count);
    else if (arrayType === 6) arrayData = module.nc_get_vara_double(workingNcid, varid, start, count);
    else arrayData = module.nc_get_vara_double(workingNcid, varid, start, count);
    if (!arrayData.data) {
        console.log(arrayData)
        throw new Error("Failed to read array data")}
    return arrayData.data
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
        const fullPath = path === '/' ? `/${name}` : `${path}/${name}`;
        allVars[fullPath] = { ...varData, path, ncid };
    }
    
    // Recurse into subgroups
    const groupsResult = module.nc_inq_grps(ncid);
    if (groupsResult.result === NC_CONSTANTS.NC_NOERR && groupsResult.grpids) {
        for (const grpid of groupsResult.grpids) {
            const nameResult = module.nc_inq_grpname(grpid);
            if (nameResult.result === NC_CONSTANTS.NC_NOERR && nameResult.name) {
                const newPath = path === '/' ? `/${nameResult.name}` : `${path}/${nameResult.name}`;
                const subVars = getVariables(module, grpid, newPath);
                Object.assign(allVars, subVars);
            }
        }
    }
    
    return allVars;
}