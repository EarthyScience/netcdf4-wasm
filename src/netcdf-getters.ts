import { NC_CONSTANTS, DATA_TYPE_SIZE, CONSTANT_DTYPE_MAP } from './constants.js';
import type { NetCDF4Module } from './types.js';

export function getVariables(
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
        const dimCheck = module.nc_inq_dimid(workingNcid, nameResult.name);
        const isCoordinate = dimCheck.result === NC_CONSTANTS.NC_NOERR;
        if (isCoordinate) continue;

        variables[nameResult.name] = {
            id: varid,
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
            units: dim.units,
            id: dim.id
        }
    }
    return dims
}

export function getDimIDs(
    module: NetCDF4Module,
    ncid: number
): number[] | Int32Array {    
    const result = module.nc_inq_dimids(ncid, 0);
    if (result.result !== NC_CONSTANTS.NC_NOERR) {
        throw new Error(`Failed to get dimension IDs (error: ${result.result})`);
    }
    return result.dimids || [0];
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
    const varResult = module.nc_inq_varid(ncid, result.name as string) 
    const varID = varResult.varid as number
    const {result: output, ...dim} = result
    const unitResult = getAttributeValues(module, ncid, varID, "units")
    return {...dim, units: unitResult, id: varID}; 
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
        return;
    }
    const attType = attInfo.type;
    if (!attType) throw new Error("Failed to allocate memory for attribute type.");
    let attValue;
    if (attType === 2) attValue = module.nc_get_att_text(ncid, varid, attname, attInfo.len as number);
    else if (attType === 3) attValue = module.nc_get_att_short(ncid, varid, attname, attInfo.len as number);
    else if (attType === 4) attValue = module.nc_get_att_int(ncid, varid, attname, attInfo.len as number);
    else if (attType === 5) attValue = module.nc_get_att_float(ncid, varid, attname, attInfo.len as number);
    else if (attType === 6) attValue = module.nc_get_att_double(ncid, varid, attname, attInfo.len as number);
    else if (attType === 10) attValue = module.nc_get_att_longlong(ncid, varid, attname, attInfo.len as number);
    else attValue = module.nc_get_att_double(ncid, varid, attname, attInfo.len as number);

    return attValue.data
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
    return result.varids || [0];
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
    const arraySize = info.size
    const arrayType = info.nctype
    
    console.log(`Loading variable array: size=${arraySize}, type=${arrayType}, shape=[${info.shape.join(', ')}]`);
    
    if (!arrayType) throw new Error("Failed to get array type")
    if (!arraySize || arraySize === 0) throw new Error("Array size is 0 or undefined")
    
    // Safety check for very large arrays
    const maxSize = 100 * 1024 * 1024; // 100MB limit for safety
    const byteSize = arraySize * DATA_TYPE_SIZE[arrayType];
    if (byteSize > maxSize) {
        throw new Error(`Array too large: ${byteSize} bytes (${arraySize} elements). Use slicing for large arrays.`);
    }
    
    let arrayData;
    try {
        if (arrayType === 2) arrayData = module.nc_get_var_text(workingNcid, varid, arraySize);
        else if (arrayType === 3) arrayData = module.nc_get_var_short(workingNcid, varid, arraySize);
        else if (arrayType === 4) arrayData = module.nc_get_var_int(workingNcid, varid, arraySize);
        else if (arrayType === 10) arrayData = module.nc_get_var_longlong(workingNcid, varid, arraySize);
        else if (arrayType === 5) arrayData = module.nc_get_var_float(workingNcid, varid, arraySize);
        else if (arrayType === 6) arrayData = module.nc_get_var_double(workingNcid, varid, arraySize);
        else arrayData = module.nc_get_var_double(workingNcid, varid, arraySize);
        
        if (arrayData.result !== NC_CONSTANTS.NC_NOERR) {
            throw new Error(`nc_get_var failed with error code: ${arrayData.result}`);
        }
        
        if (!arrayData.data) {
            throw new Error("nc_get_var returned no data")
        }
        
        console.log(`Successfully loaded ${arrayData.data.length} elements`);
        return arrayData.data;
        
    } catch (err) {
        console.error('Error in getVariableArray:', err);
        throw new Error(`Failed to read array data: ${err}`);
    }
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
    
    // Calculate total elements in the slice
    const totalElements = count.reduce((a, b) => a * b, 1);
    console.log(`Loading sliced array: start=[${start.join(', ')}], count=[${count.join(', ')}], total=${totalElements}, type=${arrayType}`);
    
    if (!arrayType) throw new Error("Failed to get array type")
    if (totalElements === 0) throw new Error("Slice size is 0")
    
    // Validate start and count arrays match dimensions
    if (start.length !== info.shape.length || count.length !== info.shape.length) {
        throw new Error(`Dimension mismatch: variable has ${info.shape.length} dimensions, but start/count have ${start.length}/${count.length}`);
    }
    
    // Validate start + count doesn't exceed shape
    for (let i = 0; i < start.length; i++) {
        if (start[i] + count[i] > info.shape[i]) {
            throw new Error(`Slice out of bounds for dimension ${i}: start=${start[i]}, count=${count[i]}, shape=${info.shape[i]}`);
        }
    }
    
    let arrayData;
    try {
        if (arrayType === 3) arrayData = module.nc_get_vara_short(workingNcid, varid, start, count);
        else if (arrayType === 4) arrayData = module.nc_get_vara_int(workingNcid, varid, start, count);
        else if (arrayType === 5) arrayData = module.nc_get_vara_float(workingNcid, varid, start, count);
        else if (arrayType === 6) arrayData = module.nc_get_vara_double(workingNcid, varid, start, count);
        else arrayData = module.nc_get_vara_double(workingNcid, varid, start, count);
        
        if (arrayData.result !== NC_CONSTANTS.NC_NOERR) {
            throw new Error(`nc_get_vara failed with error code: ${arrayData.result}`);
        }
        
        if (!arrayData.data) {
            throw new Error("nc_get_vara returned no data");
        }
        
        console.log(`Successfully loaded ${arrayData.data.length} elements from slice`);
        return arrayData.data;
        
    } catch (err) {
        console.error('Error in getSlicedVariableArray:', err);
        throw new Error(`Failed to read sliced array data: ${err}`);
    }
}

//---- Group Functions ----//

/**
 * Get group ncid by path (supports nested groups)
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
    
    // Manual traversal (handles both relative and absolute paths by stripping leading /)
    const cleanPath = groupPath.startsWith('/') ? groupPath.substring(1) : groupPath;
    const parts = cleanPath.split('/').filter(p => p.length > 0);
    
    let currentNcid = ncid;
    
    for (const part of parts) {
        const result = module.nc_inq_grp_ncid(currentNcid, part);
        if (result.result !== NC_CONSTANTS.NC_NOERR) {
            throw new Error(`Failed to get group ncid for '${part}' in path '${groupPath}' (error: ${result.result})`);
        }
        currentNcid = result.grp_ncid as number;
    }
    
    return currentNcid;
}

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
 * @param module - NetCDF4 module
 * @param ncid - Group ncid
 * @returns Full path like "/group1/subgroup"
 */
export function getGroupPath(
    module: NetCDF4Module,
    ncid: number
): string {
    const parts: string[] = [];
    let currentNcid = ncid;
    
    while (true) {
        const nameResult = module.nc_inq_grpname(currentNcid);
        if (nameResult.result !== NC_CONSTANTS.NC_NOERR) {
            break;
        }
        
        if (nameResult.name === '/' || !nameResult.name) {
            break; // Reached root
        }
        
        parts.unshift(nameResult.name);
        
        const parentResult = module.nc_inq_grp_parent(currentNcid);
        if (parentResult.result !== NC_CONSTANTS.NC_NOERR) {
            break; // No parent (at root)
        }
        
        currentNcid = parentResult.parent_ncid as number;
    }
    
    return parts.length > 0 ? '/' + parts.join('/') : '/';
}

/**
 * Get complete hierarchy: groups + their variables, dimensions, and attributes recursively
 * This is the unified method that should be used for exploring the file structure
 * @param module - NetCDF4 module
 * @param ncid - Group ncid to start from
 * @param groupPath - Optional path to a specific starting group
 * @returns Complete hierarchical structure
 */
export function getCompleteHierarchy(
    module: NetCDF4Module,
    ncid: number,
    groupPath?: string
): Record<string, any> {
    const workingNcid = groupPath ? getGroupNCID(module, ncid, groupPath) : ncid;
    
    // Get variables at this level
    const variables = getVariables(module, workingNcid);
    
    // Get dimensions at this level
    const dimensions = getDims(module, workingNcid);
    
    // Get attributes at this level
    const attributes = getGlobalAttributes(module, workingNcid);
    
    // Get subgroups and recurse
    const groupsResult = module.nc_inq_grps(workingNcid);
    const subgroups: Record<string, any> = {};
    
    if (groupsResult.result === NC_CONSTANTS.NC_NOERR && groupsResult.grpids) {
        for (const grpid of groupsResult.grpids) {
            const nameResult = module.nc_inq_grpname(grpid);
            if (nameResult.result === NC_CONSTANTS.NC_NOERR && nameResult.name) {
                // Recursively get the complete hierarchy for this subgroup
                subgroups[nameResult.name] = getCompleteHierarchy(module, grpid);
            }
        }
    }
    
    return {
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
export function getAllVariablesRecursive(
    module: NetCDF4Module,
    ncid: number,
    currentPath: string = '/'
): Record<string, any> {
    const allVars: Record<string, any> = {};
    
    // Get variables at current level
    const vars = getVariables(module, ncid);
    for (const [name, varData] of Object.entries(vars)) {
        const fullPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
        allVars[fullPath] = { ...varData, path: currentPath, ncid };
    }
    
    // Recurse into subgroups
    const groupsResult = module.nc_inq_grps(ncid);
    if (groupsResult.result === NC_CONSTANTS.NC_NOERR && groupsResult.grpids) {
        for (const grpid of groupsResult.grpids) {
            const nameResult = module.nc_inq_grpname(grpid);
            if (nameResult.result === NC_CONSTANTS.NC_NOERR && nameResult.name) {
                const newPath = currentPath === '/' ? `/${nameResult.name}` : `${currentPath}/${nameResult.name}`;
                const subVars = getAllVariablesRecursive(module, grpid, newPath);
                Object.assign(allVars, subVars);
            }
        }
    }
    
    return allVars;
}