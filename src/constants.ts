// NetCDF4 constants (populated from NetCDF4 headers)
export const NC_CONSTANTS = {
    // Error codes
    NC_NOERR: 0,
    NC_EBADID: -33,
    NC_ENFILE: -34,
    NC_EEXIST: -35,
    NC_EINVAL: -36,
    NC_EPERM: -37,
    NC_ENOTINDEFINE: -38,
    NC_EINDEFINE: -39,
    NC_EINVALCOORDS: -40,
    NC_EMAXDIMS: -41,
    NC_ENAMEINUSE: -42,
    NC_ENOTATT: -43,
    NC_EMAXATTS: -44,
    NC_EBADTYPE: -45,
    NC_EBADDIM: -46,
    NC_EUNLIMPOS: -47,
    NC_EMAXVARS: -48,
    NC_ENOTVAR: -49,
    NC_EGLOBAL: -50,
    NC_ENOTNC: -51,
    NC_ESTS: -52,
    NC_EMAXNAME: -53,
    NC_EUNLIMIT: -54,
    NC_ENORECVARS: -55,
    NC_ECHAR: -56,
    NC_EEDGE: -57,
    NC_ESTRIDE: -58,
    NC_EBADNAME: -59,
    NC_ERANGE: -60,
    NC_ENOMEM: -61,
    NC_EVARSIZE: -62,
    NC_EDIMSIZE: -63,
    NC_ETRUNC: -64,
    NC_EAXISTYPE: -65,
    
    // NetCDF-4 error codes
    NC_EDAP: -66,
    NC_ECURL: -67,
    NC_EIO: -68,
    NC_ENODATA: -69,
    NC_EDAPSVC: -70,
    NC_EDAS: -71,
    NC_EDDS: -72,
    NC_EDATADDS: -73,
    NC_EDAPURL: -74,
    NC_EDAPCONSTRAINT: -75,
    NC_ETRANSLATION: -76,
    NC_EACCESS: -77,
    NC_EAUTH: -78,
    NC_ENOTFOUND: -90,
    NC_ECANTREMOVE: -91,
    NC_EHDFERR: -101,
    NC_ECANTREAD: -102,
    NC_ECANTWRITE: -103,
    NC_ECANTCREATE: -104,
    NC_EFILEMETA: -105,
    NC_EDIMMETA: -106,
    NC_EATTMETA: -107,
    NC_EVARMETA: -108,
    NC_ENOCOMPOUND: -109,
    NC_EATTEXISTS: -110,
    NC_ENOTNC4: -111,
    NC_ESTRICTNC3: -112,
    NC_ENOTNC3: -113,
    NC_ENOPAR: -114,
    NC_EPARINIT: -115,
    NC_EBADGRPID: -116,
    NC_EBADTYPID: -117,
    NC_ETYPDEFINED: -118,
    NC_EBADFIELD: -119,
    NC_EBADCLASS: -120,
    NC_EMAPTYPE: -121,
    NC_ELATEFILL: -122,
    NC_ELATEDEF: -123,
    NC_EDIMSCALE: -124,
    NC_ENOGRP: -125,
    NC_ESTORAGE: -126,
    NC_EBADCHUNK: -127,
    NC_ENOTBUILT: -128,
    NC_EDISKLESS: -129,
    NC_ECANTEXTEND: -130,
    NC_EMPI: -131,
    
    // File modes
    NC_NOWRITE: 0x0000,
    NC_WRITE: 0x0001,
    NC_CLOBBER: 0x0000,
    NC_NOCLOBBER: 0x0004,
    NC_DISKLESS: 0x0008,
    NC_MMAP: 0x0010,
    NC_64BIT_DATA: 0x0020,
    NC_CDF5: 0x0020,
    NC_CLASSIC_MODEL: 0x0100,
    NC_64BIT_OFFSET: 0x0200,
    NC_NETCDF4: 0x1000,
    NC_SHARE: 0x0800,
    NC_INMEMORY: 0x8000,
    
    // Format versions
    NC_FORMAT_CLASSIC: 1,
    NC_FORMAT_64BIT_OFFSET: 2,
    NC_FORMAT_64BIT: 2,
    NC_FORMAT_NETCDF4: 3,
    NC_FORMAT_NETCDF4_CLASSIC: 4,
    NC_FORMAT_64BIT_DATA: 5,
    NC_FORMAT_CDF5: 5,
    
    // Data types (atomic types)
    NC_NAT: 0,         // Not A Type
    NC_BYTE: 1,        // signed 1-byte integer
    NC_CHAR: 2,        // text character
    NC_SHORT: 3,       // signed 2-byte integer
    NC_INT: 4,         // signed 4-byte integer
    NC_LONG: 4,        // deprecated, same as NC_INT
    NC_FLOAT: 5,       // single precision float
    NC_DOUBLE: 6,      // double precision float
    NC_UBYTE: 7,       // unsigned 1-byte integer
    NC_USHORT: 8,      // unsigned 2-byte integer
    NC_UINT: 9,        // unsigned 4-byte integer
    NC_INT64: 10,      // signed 8-byte integer
    NC_UINT64: 11,     // unsigned 8-byte integer
    NC_STRING: 12,     // variable-length string
    
    // Aliases for 64-bit integers
    NC_LONGLONG: 10,   // alias for NC_INT64
    NC_ULONGLONG: 11,  // alias for NC_UINT64
    
    // User-defined types (NetCDF-4)
    NC_VLEN: 13,       // variable-length type
    NC_OPAQUE: 14,     // opaque type
    NC_ENUM: 15,       // enumeration type
    NC_COMPOUND: 16,   // compound type
    
    // First user-defined type ID
    NC_FIRSTUSERTYPEID: 32,
    
    // Fill modes
    NC_FILL: 0,
    NC_NOFILL: 0x100,
    
    // Storage types
    NC_CHUNKED: 0,
    NC_CONTIGUOUS: 1,
    NC_COMPACT: 2,
    NC_VIRTUAL: 3,
    
    // Endianness
    NC_ENDIAN_NATIVE: 0,
    NC_ENDIAN_LITTLE: 1,
    NC_ENDIAN_BIG: 2,
    
    // Unlimited dimension
    NC_UNLIMITED: 0,
    
    // Special values
    NC_GLOBAL: -1,     // Global attribute
    NC_MAX_DIMS: 1024,
    NC_MAX_ATTRS: 8192,
    NC_MAX_VARS: 8192,
    NC_MAX_NAME: 256,
    NC_MAX_VAR_DIMS: 1024,
    
    // Compression
    NC_NOCHECKSUM: 0,
    NC_FLETCHER32: 1,
    
    // Shuffle filter
    NC_NOSHUFFLE: 0,
    NC_SHUFFLE: 1,
};

// Data type mapping from string names to NetCDF constants
export const DATA_TYPE_MAP: { [key: string]: number } = {
    // Short names
    'f8': NC_CONSTANTS.NC_DOUBLE,
    'f4': NC_CONSTANTS.NC_FLOAT,
    'i8': NC_CONSTANTS.NC_INT64,
    'i4': NC_CONSTANTS.NC_INT,
    'i2': NC_CONSTANTS.NC_SHORT,
    'i1': NC_CONSTANTS.NC_BYTE,
    'u8': NC_CONSTANTS.NC_UINT64,
    'u4': NC_CONSTANTS.NC_UINT,
    'u2': NC_CONSTANTS.NC_USHORT,
    'u1': NC_CONSTANTS.NC_UBYTE,
    'S1': NC_CONSTANTS.NC_CHAR,
    
    // Long names
    'double': NC_CONSTANTS.NC_DOUBLE,
    'float': NC_CONSTANTS.NC_FLOAT,
    'int64': NC_CONSTANTS.NC_INT64,
    'int': NC_CONSTANTS.NC_INT,
    'short': NC_CONSTANTS.NC_SHORT,
    'byte': NC_CONSTANTS.NC_BYTE,
    'uint64': NC_CONSTANTS.NC_UINT64,
    'uint': NC_CONSTANTS.NC_UINT,
    'ushort': NC_CONSTANTS.NC_USHORT,
    'ubyte': NC_CONSTANTS.NC_UBYTE,
    'char': NC_CONSTANTS.NC_CHAR,
    'string': NC_CONSTANTS.NC_STRING,
    'str': NC_CONSTANTS.NC_STRING,
    
    // Aliases
    'longlong': NC_CONSTANTS.NC_LONGLONG,
    'ulonglong': NC_CONSTANTS.NC_ULONGLONG,
    'long': NC_CONSTANTS.NC_INT,
};

// Reverse mapping: NetCDF type ID to dtype string
export const CONSTANT_DTYPE_MAP: { [key: number]: string } = {
    0: 'NAT',    // NC_NAT
    1: 'i1',     // NC_BYTE
    2: 'S1',     // NC_CHAR
    3: 'i2',     // NC_SHORT
    4: 'i4',     // NC_INT
    5: 'f4',     // NC_FLOAT
    6: 'f8',     // NC_DOUBLE
    7: 'u1',     // NC_UBYTE
    8: 'u2',     // NC_USHORT
    9: 'u4',     // NC_UINT
    10: 'i8',    // NC_INT64
    11: 'u8',    // NC_UINT64
    12: 'str',   // NC_STRING
};

// Data type sizes in bytes
export const DATA_TYPE_SIZE: { [key: number]: number } = {
    0: 0,    // NC_NAT
    1: 1,    // NC_BYTE
    2: 1,    // NC_CHAR
    3: 2,    // NC_SHORT
    4: 4,    // NC_INT
    5: 4,    // NC_FLOAT
    6: 8,    // NC_DOUBLE
    7: 1,    // NC_UBYTE
    8: 2,    // NC_USHORT
    9: 4,    // NC_UINT
    10: 8,   // NC_INT64
    11: 8,   // NC_UINT64
    12: 0,   // NC_STRING (variable length)
};

// Human-readable type names
export const TYPE_NAMES: { [key: number]: string } = {
    0: 'NAT',
    1: 'byte',
    2: 'char',
    3: 'short',
    4: 'int',
    5: 'float',
    6: 'double',
    7: 'ubyte',
    8: 'ushort',
    9: 'uint',
    10: 'int64',
    11: 'uint64',
    12: 'string',
    13: 'vlen',
    14: 'opaque',
    15: 'enum',
    16: 'compound',
};