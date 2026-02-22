// Type definitions for NetCDF4 WASM

export interface EmscriptenModule {
    ccall: (name: string, returnType: string, argTypes: string[], args: any[]) => any;
    cwrap: (name: string, returnType: string, argTypes: string[]) => (...args: any[]) => any;
    getValue: (ptr: number, type: string) => number;
    setValue: (ptr: number, value: number, type: string) => void;
    UTF8ToString: (ptr: number) => string;
    stringToUTF8: (str: string, outPtr: number, maxBytesToWrite: number) => void;
    lengthBytesUTF8: (str: string) => number;
    _malloc: (size: number) => number;
    _free: (ptr: number) => void;
    allocateString: (str: string) => number;
    freeString: (ptr: number) => void;
    FS: any;
    WORKERFS: any;
    ready: Promise<EmscriptenModule>;
    HEAPF64: Float64Array;
    HEAP64: BigInt64Array;
    HEAP32: Int32Array;
    HEAP8: Int8Array;
    HEAPF32: Float32Array;
    HEAPU8: Uint8Array;
    HEAP16: Int16Array;
    HEAPU16: Uint16Array;
    HEAPU32: Uint32Array;
    HEAPU64: BigUint64Array;
}

export interface NetCDF4Module extends EmscriptenModule {
    // Wrapped NetCDF4 functions
    nc_open: (path: string, mode: number) => { result: number; ncid: number };
    nc_close: (ncid: number) => number;
    nc_create: (path: string, mode: number) => { result: number; ncid: number };
    nc_def_dim: (ncid: number, name: string, len: number) => { result: number; dimid: number };
    nc_def_var: (ncid: number, name: string, xtype: number, ndims: number, dimids: number[]) => { result: number; varid: number };
    nc_put_var_double: (ncid: number, varid: number, data: Float64Array) => number;
    // nc_get_var_double: (ncid: number, varid: number, size: number) => { result: number; data: Float64Array };
    nc_enddef: (ncid: number) => number;

    // 1. Dimension inquiry
    nc_inq_ndims: (ncid: number) => { result: any; ndims: number | undefined; };
    nc_inq_dimids(ncid: number, include_parents: number): { result: number; ndims?: number; dimids?: Int32Array }
    nc_inq_unlimdim(ncid: number): { result: number; unlimdimid?: number }
    nc_inq_dim(ncid: number, dimid: number): { result: number; name?: string; len?: number }
    nc_inq_dimid(ncid: number, name: string): { result: number; dimid?: number }
    nc_inq_dimlen(ncid: number, dimid: number): { result: number; len?: number }
    nc_inq_dimname(ncid: number, dimid: number): { result: number; name?: string }

    // 2. Variable inquiry
    nc_inq_nvars(ncid: number): { result: number; nvars?: number }
    nc_inq_varids(ncid: number): { result: number; nvars?: number; varids?: Int32Array }
    nc_inq_varid(ncid: number, name: string): { result: number; varid?: number }

    nc_inq_var(ncid: number, varid: number): {
        result: number;
        name?: string;
        type?: number;      // nc_type enum value
        ndims?: number;
        dimids?: Int32Array;
        natts?: number;
    }
    nc_inq_varname(ncid: number, varid: number): { result: number; name?: string }
    nc_inq_vartype(ncid: number, varid: number): { result: number; type?: number }
    nc_inq_varndims(ncid: number, varid: number): { result: number; ndims?: number }
    nc_inq_vardimid(ncid: number, varid: number): { result: number; dimids?: Int32Array }
    nc_inq_varnatts(ncid: number, varid: number): { result: number; natts?: number }
    nc_inq_var_chunking(ncid: number, varid: number): { result: number; chunking?: number; chunkSizes?: number[] }

    // 3. Attribute inquiry
    nc_inq_natts(ncid: number): { result: number; natts?: number }  // global attributes
    nc_inq_att(ncid: number, varid: number, name: string): { result: number; type?: number; len?: number }
    nc_inq_attid(ncid: number, varid: number, name: string): { result: number; attnum?: number }
    nc_inq_attname(ncid: number, varid: number, attnum: number): { result: number; name?: string }
    nc_inq_atttype(ncid: number, varid: number, name: string): { result: number; type?: number }
    nc_inq_attlen(ncid: number, varid: number, name: string): { result: number; len?: number }

    // 4. Attribute Getters
    nc_get_att_text(ncid: number, varid: number, name: string, length: number): { result: number; data?: string }
    nc_get_att_short(ncid: number, varid: number, name: string, length: number): { result: number; data?: number[] }
    nc_get_att_int(ncid: number, varid: number, name: string, length: number): { result: number; data?: number[] }
    nc_get_att_float(ncid: number, varid: number, name: string, length: number): { result: number; data?: number[] }
    nc_get_att_double(ncid: number, varid: number, name: string, length: number): { result: number; data?: number[] }
    nc_get_att_longlong(ncid: number, varid: number, name: string, length: number): { result: number; data?: BigInt[] }
    nc_get_att_string: (ncid: number, varid: number, name: string, length: number) => { result: number; data?: string[] };
    nc_get_att_schar: (ncid: number, varid: number, name: string, length: number) => { result: number; data?: Int8Array };
    // 8-bit unsigned
    nc_get_att_uchar: (ncid: number, varid: number, name: string, length: number) => { result: number; data?: Uint8Array };
    // 16-bit unsigned
    nc_get_att_ushort: (ncid: number, varid: number, name: string, length: number) => { result: number; data?: Uint16Array };
    // 32-bit unsigned
    nc_get_att_uint: (ncid: number, varid: number, name: string, length: number) => { result: number; data?: Uint32Array };
    // 64-bit unsigned
    nc_get_att_ulonglong: (ncid: number, varid: number, name: string, length: number) => { result: number; data?: BigUint64Array };

    // 5. Variable Getters
    nc_get_var_text: (ncid: number, varid: number,  length: number) => { result: number; data?: string[] };
    nc_get_var_short: (ncid: number, varid: number,  length: number) => { result: number; data?: Int16Array };
    nc_get_var_int: (ncid: number, varid: number,  length: number) => { result: number; data?: Int32Array };
    nc_get_var_longlong: (ncid: number, varid: number,  length: number) => { result: number; data?: BigInt64Array };
    nc_get_var_float: (ncid: number, varid: number,  length: number) => { result: number; data?: Float32Array };
    nc_get_var_double: (ncid: number, varid: number,  length: number) => { result: number; data?: Float64Array };
    nc_get_var_schar: (ncid: number, varid: number, length: number) => { result: number; data?: Int8Array };
    nc_get_var_uchar: (ncid: number, varid: number, length: number) => { result: number; data?: Uint8Array };
    nc_get_var_ushort: (ncid: number, varid: number, length: number) => { result: number; data?: Uint16Array };
    nc_get_var_uint: (ncid: number, varid: number, length: number) => { result: number; data?: Uint32Array };
    nc_get_var_ulonglong: (ncid: number, varid: number, length: number) => { result: number; data?: BigUint64Array };
    nc_get_var_string: (ncid: number, varid: number, length: number) => { result: number; data?: string[] };

    nc_get_vara_short: (ncid: number, varid: number, startp: number[], countp: number[]) => { result: number; data?: Int16Array };
    nc_get_vara_int: (ncid: number, varid: number, startp: number[], countp: number[]) => { result: number; data?: Int32Array };
    nc_get_vara_float: (ncid: number, varid: number, startp: number[], countp: number[]) => { result: number; data?: Float32Array };
    nc_get_vara_double: (ncid: number, varid: number, startp: number[], countp: number[]) => { result: number; data?: Float64Array };
    nc_get_vara_longlong: (ncid: number, varid: number, startp: number[], countp: number[]) => { result: number; data?: BigInt64Array };
    nc_get_vara_schar: (ncid: number, varid: number, startp: number[], countp: number[]) => { result: number; data?: Int8Array };
    nc_get_vara_uchar: (ncid: number, varid: number, startp: number[], countp: number[]) => { result: number; data?: Uint8Array };
    nc_get_vara_ushort: (ncid: number, varid: number, startp: number[], countp: number[]) => { result: number; data?: Uint16Array };
    nc_get_vara_uint: (ncid: number, varid: number, startp: number[], countp: number[]) => { result: number; data?: Uint32Array };
    nc_get_vara_ulonglong: (ncid: number, varid: number, startp: number[], countp: number[]) => { result: number; data?: BigUint64Array };
    nc_get_vara_string: (ncid: number, varid: number, startp: number[], countp: number[]) => { result: number; data?: string[] };


    // Strided Variable Getters (nc_get_vars_*)
    // stride[i] = step along dimension i (must be >= 1; negatives handled at higher level)
    nc_get_vars_schar:     (ncid: number, varid: number, startp: number[], countp: number[], stridep: number[]) => { result: number; data?: Int8Array };
    nc_get_vars_uchar:     (ncid: number, varid: number, startp: number[], countp: number[], stridep: number[]) => { result: number; data?: Uint8Array };
    nc_get_vars_short:     (ncid: number, varid: number, startp: number[], countp: number[], stridep: number[]) => { result: number; data?: Int16Array };
    nc_get_vars_ushort:    (ncid: number, varid: number, startp: number[], countp: number[], stridep: number[]) => { result: number; data?: Uint16Array };
    nc_get_vars_int:       (ncid: number, varid: number, startp: number[], countp: number[], stridep: number[]) => { result: number; data?: Int32Array };
    nc_get_vars_uint:      (ncid: number, varid: number, startp: number[], countp: number[], stridep: number[]) => { result: number; data?: Uint32Array };
    nc_get_vars_float:     (ncid: number, varid: number, startp: number[], countp: number[], stridep: number[]) => { result: number; data?: Float32Array };
    nc_get_vars_double:    (ncid: number, varid: number, startp: number[], countp: number[], stridep: number[]) => { result: number; data?: Float64Array };
    nc_get_vars_longlong:  (ncid: number, varid: number, startp: number[], countp: number[], stridep: number[]) => { result: number; data?: BigInt64Array };
    nc_get_vars_ulonglong: (ncid: number, varid: number, startp: number[], countp: number[], stridep: number[]) => { result: number; data?: BigUint64Array };
    nc_get_vars_string:    (ncid: number, varid: number, startp: number[], countp: number[], stridep: number[]) => { result: number; data?: string[] };
    nc_get_vars_generic:   (ncid: number, varid: number, startp: number[], countp: number[], stridep: number[], nctype: number) => { result: number; data?: Int8Array | Uint8Array | Int16Array | Uint16Array | Int32Array | Uint32Array | BigInt64Array | BigUint64Array };

    // group types and functions
    nc_inq_grps: (ncid: number) => { result: number; numgrps?: number; grpids?: Int32Array };
    nc_inq_grp_ncid: (ncid: number, grp_name: string) => { result: number; grp_ncid?: number };
    nc_inq_grpname: (ncid: number) => { result: number; name?: string };
    nc_inq_grp_parent: (ncid: number) => { result: number; parent_ncid?: number };
    nc_inq_grp_full_ncid: (ncid: number, full_name: string) => { result: number; grp_ncid?: number };
    nc_inq_grpname_full: (ncid: number) => { result: number; full_name?: string };
    nc_inq_grpname_len: (ncid: number) => { result: number; lenp?: number };
    
    // Generic variable getters (for enums and type-agnostic reading)
    nc_get_var_generic: (ncid: number, varid: number, length: number, nctype: number) => { result: number; data?: Int8Array | Uint8Array | Int16Array | Uint16Array | Int32Array | Uint32Array | BigInt64Array | BigUint64Array };
    nc_get_vara_generic: (ncid: number, varid: number, start: number[], count: number[], nctype: number) => { result: number; data?: Int8Array | Uint8Array | Int16Array | Uint16Array | Int32Array | Uint32Array | BigInt64Array | BigUint64Array };
    
    // User-defined type inquiry
    nc_inq_typeids: (ncid: number, maxTypeIds: number) => { result: number; ntypes?: number; typeids?: number[] };
    nc_inq_type: (ncid: number, xtype: number) => { result: number; name?: string; size?: number };
    nc_inq_user_type: (ncid: number, xtype: number) => { result: number; name?: string; size?: number; baseType?: number; nfields?: number; typeClass?: number };
    
    // Enum type functions
    nc_def_enum: (ncid: number, baseTypeId: number, name: string) => { result: number; typeid?: number };
    nc_insert_enum: (ncid: number, xtype: number, name: string, value: number | bigint) => { result: number };
    nc_inq_enum: (ncid: number, xtype: number) => { result: number; name?: string; baseType?: number; baseSize?: number; numMembers?: number };
    nc_inq_enum_member: (ncid: number, xtype: number, idx: number, baseType: number) => { result: number; name?: string; value?: number | bigint };
    nc_inq_enum_ident: (ncid: number, xtype: number, value: number | bigint) => { result: number; identifier?: string };
}

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

export interface MemoryDatasetSource {
    data: ArrayBuffer | Uint8Array;
    filename?: string;
}

// Union type for polymorphic Dataset constructor
export type DatasetSource = string | Blob | ArrayBuffer | Uint8Array;

export interface VariableOptions {
    zlib?: boolean;
    complevel?: number;
    shuffle?: boolean;
    fletcher32?: boolean;
    contiguous?: boolean;
    chunksizes?: number[];
}