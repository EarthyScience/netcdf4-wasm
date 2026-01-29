#!/bin/bash

# Enable strict error handling and debugging
set -euo pipefail

# NetCDF4 WASM Build Script
# This script builds the netcdf4 library to WebAssembly using Emscripten

# Enable verbose output for debugging
VERBOSE=${VERBOSE:-0}
if [ "$VERBOSE" = "1" ]; then
    set -x
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_ROOT/build"
DIST_DIR="$PROJECT_ROOT/dist"
DEPS_DIR="$BUILD_DIR/deps"
INSTALL_DIR="$BUILD_DIR/install"

# Versions
ZLIB_VERSION="1.3.1"
HDF5_VERSION="1.14.3"
NETCDF_VERSION="4.9.2"

# Download URLs
ZLIB_URL="https://zlib.net/zlib-${ZLIB_VERSION}.tar.gz"
HDF5_URL="https://github.com/HDFGroup/hdf5/archive/refs/tags/hdf5-${HDF5_VERSION//./_}.tar.gz"
NETCDF_URL="https://github.com/Unidata/netcdf-c/archive/refs/tags/v${NETCDF_VERSION}.tar.gz"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# Function to handle errors
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Function to check if command succeeded
check_command() {
    if ! "$@"; then
        error_exit "Command failed: $*"
    fi
}

# Function to apply config.h patches for NetCDF4 Emscripten compatibility
apply_config_patches() {
    local config_file="$1"

    if [ ! -f "$config_file" ]; then
        error_exit "config.h not found at $config_file"
    fi

    log "Patching config.h for Emscripten compatibility..."

    # Determine correct sed -i syntax for the platform
    local SED_INPLACE
    if sed --version >/dev/null 2>&1; then
        # GNU sed
        SED_INPLACE=(-i)
    else
        # BSD/macOS sed
        SED_INPLACE=(-i '')
    fi

    # Fix SIZEOF definitions for WebAssembly (32-bit target)
    sed "${SED_INPLACE[@]}" \
        -e 's|/\* #undef SIZEOF_DOUBLE \*/|#define SIZEOF_DOUBLE 8|' \
        -e 's|/\* #undef SIZEOF_FLOAT \*/|#define SIZEOF_FLOAT 4|' \
        -e 's|/\* #undef SIZEOF_INT \*/|#define SIZEOF_INT 4|' \
        -e 's|/\* #undef SIZEOF_LONG \*/|#define SIZEOF_LONG 4|' \
        -e 's|/\* #undef SIZEOF_LONG_LONG \*/|#define SIZEOF_LONG_LONG 8|' \
        -e 's|/\* #undef SIZEOF_SHORT \*/|#define SIZEOF_SHORT 2|' \
        -e 's|/\* #undef SIZEOF_SIZE_T \*/|#define SIZEOF_SIZE_T 4|' \
        -e 's|/\* #undef SIZEOF_CHAR \*/|#define SIZEOF_CHAR 1|' \
        -e 's|/\* #undef SIZEOF_UCHAR \*/|#define SIZEOF_UCHAR 1|' \
        -e 's|/\* #undef SIZEOF_OFF_T \*/|#define SIZEOF_OFF_T 4|' \
        -e 's|/\* #undef SIZEOF_OFF64_T \*/|#define SIZEOF_OFF64_T 8|' \
        -e 's|/\* #undef SIZEOF_ULONGLONG \*/|#define SIZEOF_ULONGLONG 8|' \
        -e 's|/\* #undef SIZEOF_UINT \*/|#define SIZEOF_UINT 4|' \
        -e 's|/\* #undef SIZEOF_USHORT \*/|#define SIZEOF_USHORT 2|' \
        -e 's|/\* #undef SIZEOF___INT64 \*/|#define SIZEOF___INT64 8\n#define SIZEOF_UINT64_T 8\n#define SIZEOF_UINT64 8|' \
        "$config_file"

    # Fix endianness
    sed "${SED_INPLACE[@]}" 's|#define WORDS_BIGENDIAN 1|/* #undef WORDS_BIGENDIAN */|' "$config_file"

    # Disable Windows-specific features
    sed "${SED_INPLACE[@]}" 's|#define HAVE_FILE_LENGTH_I64 1|/* #undef HAVE_FILE_LENGTH_I64 */|' "$config_file"

    # Add ssize_t definition guard (BSD/macOS safe)
    if command -v perl >/dev/null 2>&1; then
        # Use Perl for cross-platform multi-line insertion
        perl -i -pe '
            if (/^#define SIZEOF_SIZE_T/) {
                $_ .= "/* Define to 1 if you have the `ssize_t` type. */\n#define HAVE_SSIZE_T 1\n";
            }
        ' "$config_file"
    else
        # fallback: warn
        log "⚠️  Skipping ssize_t patch: perl not found, may fail on macOS"
    fi

    # Disable HDF5 collective metadata operations for non-parallel build
    sed "${SED_INPLACE[@]}" 's|#define HDF5_HAS_COLL_METADATA_OPS 1|/* #undef HDF5_HAS_COLL_METADATA_OPS */|' "$config_file"

    log "✅ config.h patches applied"
}

log "Building NetCDF4 for WebAssembly..."
log "Script directory: $SCRIPT_DIR"
log "Project root: $PROJECT_ROOT"
log "Build directory: $BUILD_DIR"

# Source Emscripten environment if available locally
if [ -f "$BUILD_DIR/emsdk/emsdk_env.sh" ]; then
    log "Loading local Emscripten environment..."
    source "$BUILD_DIR/emsdk/emsdk_env.sh"
fi

# Check if Emscripten is available
if ! command -v emcc &> /dev/null; then
    error_exit "Emscripten not found. Please install and activate the Emscripten SDK.
Run: npm run install-emscripten
Or visit: https://emscripten.org/docs/getting_started/downloads.html"
fi

EMCC_VERSION=$(emcc --version | head -n1)
log "Using Emscripten: $EMCC_VERSION"

# Create directories
log "Creating build directories..."
mkdir -p "$BUILD_DIR" "$DIST_DIR" "$DEPS_DIR" "$INSTALL_DIR"

cd "$BUILD_DIR"
log "Working directory: $(pwd)"

# Set Emscripten environment variables
export CC=emcc
export CXX=em++
export AR=emar
export RANLIB=emranlib
export LIBTOOL=emar
export CFLAGS="-O2 -I$INSTALL_DIR/include"
export CXXFLAGS="$CFLAGS"

log "Emscripten environment variables set:"
log "  CC=$CC"
log "  CXX=$CXX"
log "  AR=$AR"
log "  RANLIB=$RANLIB"

# Build zlib
log "Starting zlib build process..."
if [ ! -f "$INSTALL_DIR/lib/libz.a" ]; then
    log "zlib not found, building from source..."
    cd "$DEPS_DIR"
    log "Changed to deps directory: $(pwd)"
    
    if [ ! -d "zlib-$ZLIB_VERSION" ]; then
        log "Downloading zlib-$ZLIB_VERSION..."
        
        # Try wget first, then curl
        if command -v wget &> /dev/null; then
            log "Using wget to download zlib..."
            check_command wget -v "$ZLIB_URL" -O "zlib-$ZLIB_VERSION.tar.gz"
        elif command -v curl &> /dev/null; then
            log "Using curl to download zlib..."
            check_command curl -L "$ZLIB_URL" -o "zlib-$ZLIB_VERSION.tar.gz"
        else
            error_exit "Neither wget nor curl available for downloading"
        fi
        
        log "Extracting zlib archive..."
        check_command tar -xzf "zlib-$ZLIB_VERSION.tar.gz"
        log "zlib extracted successfully"
    else
        log "zlib source directory already exists"
    fi
    
    cd "zlib-$ZLIB_VERSION"
    log "Configuring zlib in directory: $(pwd)"
    
    # Configure with verbose output
    log "Running emconfigure ./configure..."
    check_command emconfigure ./configure --prefix="$INSTALL_DIR" --static
    
    log "Building zlib with emmake..."
    # Use single core for initial build to avoid issues
    check_command emmake make -j1 AR=emar ARFLAGS=rcs RANLIB=emranlib
    
    log "Installing zlib..."
    check_command emmake make install
    
    log "✅ zlib built and installed successfully"
    
    # Verify installation
    if [ -f "$INSTALL_DIR/lib/libz.a" ]; then
        log "✅ zlib library verified at $INSTALL_DIR/lib/libz.a"
    else
        error_exit "zlib library not found after installation"
    fi
else
    log "✅ zlib already built and installed"
fi

# Build HDF5
log "Starting HDF5 build process..."
if [ ! -f "$INSTALL_DIR/lib/libhdf5.a" ]; then
    log "HDF5 not found, building from source..."
    cd "$DEPS_DIR"
    log "Changed to deps directory: $(pwd)"
    
    if [ ! -d "hdf5-$HDF5_VERSION" ]; then
        log "Downloading HDF5-$HDF5_VERSION..."
        
        HDF5_DOWNLOAD_NAME="hdf5-${HDF5_VERSION//./_}.tar.gz"
        if command -v wget &> /dev/null; then
            log "Using wget to download HDF5..."
            check_command wget -v "$HDF5_URL" -O "$HDF5_DOWNLOAD_NAME"
        elif command -v curl &> /dev/null; then
            log "Using curl to download HDF5..."
            check_command curl -L "$HDF5_URL" -o "$HDF5_DOWNLOAD_NAME"
        else
            error_exit "Neither wget nor curl available for downloading"
        fi
        
        log "Extracting HDF5 archive..."
        # The downloaded file has underscores, but we extract to dots
        HDF5_DOWNLOAD_NAME="hdf5-${HDF5_VERSION//./_}.tar.gz"
        check_command tar -xzf "$HDF5_DOWNLOAD_NAME"
        check_command mv "hdf5-hdf5-${HDF5_VERSION//./_}" "hdf5-$HDF5_VERSION"
        log "HDF5 extracted successfully"
    else
        log "HDF5 source directory already exists"
    fi
    
    cd "hdf5-$HDF5_VERSION"
    log "Configuring HDF5 in directory: $(pwd)"
    mkdir -p build && cd build
    
    log "Running emcmake cmake for HDF5..."
    check_command emcmake cmake .. \
        -DCMAKE_INSTALL_PREFIX="$INSTALL_DIR" \
        -DCMAKE_BUILD_TYPE=Release \
        -DCMAKE_C_FLAGS="-s ALLOW_MEMORY_GROWTH=1 -s MODULARIZE=1 -s EXPORT_ES6=1 -s EXPORTED_RUNTIME_METHODS=['FS','cwrap','ccall']" \
        -DENABLE_FILEMAP=OFF \
        -DBUILD_SHARED_LIBS=OFF \
        -DHDF5_ENABLE_THREADSAFE=OFF \
        -DHDF5_ENABLE_PARALLEL=OFF \
        -DHDF5_BUILD_TOOLS=OFF \
        -DHDF5_BUILD_EXAMPLES=OFF \
        -DHDF5_BUILD_TESTS=OFF \
        -DBUILD_TESTING=OFF \
        -DHDF5_ENABLE_TESTS=OFF \
        -DCMAKE_C_BYTE_ORDER=LITTLE_ENDIAN \
        -DHDF5_DISABLE_COMPILER_WARNINGS=ON \
        -DZLIB_ROOT="$INSTALL_DIR" \
        -DZLIB_INCLUDE_DIR="$INSTALL_DIR/include" \
        -DZLIB_LIBRARY="$INSTALL_DIR/lib/libz.a"
    
    log "Building HDF5 with emmake..."
    check_command emmake make -j1 AR=emar ARFLAGS=rcs RANLIB=emranlib
    
    log "Installing HDF5..."
    check_command emmake make install
    
    log "✅ HDF5 built and installed successfully"
    
    # Verify installation
    if [ -f "$INSTALL_DIR/lib/libhdf5.a" ]; then
        log "✅ HDF5 library verified at $INSTALL_DIR/lib/libhdf5.a"
    else
        error_exit "HDF5 library not found after installation"
    fi
else
    log "✅ HDF5 already built and installed"
fi

# Build NetCDF4
log "Starting NetCDF4 build process..."
if [ ! -f "$INSTALL_DIR/lib/libnetcdf.a" ]; then
    log "NetCDF4 not found, building from source..."
    cd "$DEPS_DIR"
    log "Changed to deps directory: $(pwd)"
    
    if [ ! -d "netcdf-c-$NETCDF_VERSION" ]; then
        log "Downloading NetCDF4-$NETCDF_VERSION..."
        
        if command -v wget &> /dev/null; then
            log "Using wget to download NetCDF4..."
            check_command wget -v "$NETCDF_URL" -O "netcdf-c-$NETCDF_VERSION.tar.gz"
        elif command -v curl &> /dev/null; then
            log "Using curl to download NetCDF4..."
            check_command curl -L "$NETCDF_URL" -o "netcdf-c-$NETCDF_VERSION.tar.gz"
        else
            error_exit "Neither wget nor curl available for downloading"
        fi
        
        log "Extracting NetCDF4 archive..."
        check_command tar -xzf "netcdf-c-$NETCDF_VERSION.tar.gz"
        log "NetCDF4 extracted successfully"
    else
        log "NetCDF4 source directory already exists"
    fi
    
    cd "netcdf-c-$NETCDF_VERSION"
    log "Configuring NetCDF4 in directory: $(pwd)"
    
    # Apply CMakeLists.txt patches before CMake configuration
    log "Patching CMakeLists.txt to bypass CHECK_LIBRARY_EXISTS calls..."

    # Determine sed syntax for in-place editing
    if sed --version >/dev/null 2>&1; then
        # GNU sed (Linux)
        SED_INPLACE=(-i)
    else
        # BSD sed (macOS)
        SED_INPLACE=(-i '')
    fi

    # Comment out all CHECK_LIBRARY_EXISTS calls that cause issues in Emscripten
    sed "${SED_INPLACE[@]}" '933s/^/  # /' CMakeLists.txt || error_exit "Failed to patch CHECK_LIBRARY_EXISTS H5Pget_fapl_mpio"
    sed "${SED_INPLACE[@]}" '941s/^/  # /' CMakeLists.txt || error_exit "Failed to comment CHECK_LIBRARY_EXISTS H5Pset_all_coll_metadata_ops"
    sed "${SED_INPLACE[@]}" '950s/^/  # /' CMakeLists.txt || error_exit "Failed to comment CHECK_LIBRARY_EXISTS H5Dread_chunk"
    sed "${SED_INPLACE[@]}" '953s/^/  # /' CMakeLists.txt || error_exit "Failed to comment CHECK_LIBRARY_EXISTS H5Pset_fapl_ros3"

    # Set bypass variables for the features
    sed "${SED_INPLACE[@]}" '943s/SET(HDF5_HAS_COLL_METADATA_OPS ON)/SET(HDF5_HAS_COLL_METADATA_OPS OFF)/' CMakeLists.txt || error_exit "Failed to set HDF5_HAS_COLL_METADATA_OPS to OFF"
    sed "${SED_INPLACE[@]}" '950a\
    # Set HAS_READCHUNKS to OFF for Emscripten\
    SET(HAS_READCHUNKS OFF)' CMakeLists.txt || error_exit "Failed to set HAS_READCHUNKS"
    sed "${SED_INPLACE[@]}" '953a\
    # Set HAS_HDF5_ROS3 to OFF for Emscripten\
    SET(HAS_HDF5_ROS3 OFF)' CMakeLists.txt || error_exit "Failed to set HAS_HDF5_ROS3"

    log "✅ CMakeLists.txt patches applied"
    
    mkdir -p build && cd build
    
    log "Running emcmake cmake for NetCDF4..."
    check_command emcmake cmake .. \
        -DCMAKE_INSTALL_PREFIX="$INSTALL_DIR" \
        -DCMAKE_BUILD_TYPE=Release \
        -DENABLE_FILEMAP=OFF \
        -DCMAKE_BINARY_DIR="$BUILD_DIR/deps/netcdf-c-$NETCDF_VERSION/build" \
        -DBUILD_SHARED_LIBS=OFF \
        -DENABLE_NETCDF_4=ON \
        -DENABLE_HDF5=ON \
        -DENABLE_DAP=OFF \
        -DENABLE_BYTERANGE=OFF \
        -DBUILD_UTILITIES=OFF \
        -DBUILD_TESTING=OFF \
        -DENABLE_TESTS=OFF \
        -DCMAKE_C_BYTE_ORDER=LITTLE_ENDIAN \
        -DWORDS_BIGENDIAN=OFF \
        -DHDF5_USE_STATIC_LIBRARIES=ON \
        -DHDF5_PREFER_PARALLEL=OFF \
        -DHDF5_FIND_QUIETLY=ON \
        -DHDF5_INCLUDE_DIR="$INSTALL_DIR/include" \
        -DHDF5_C_INCLUDE_DIR="$INSTALL_DIR/include" \
        -DHDF5_C_LIBRARY="$INSTALL_DIR/lib/libhdf5.a;$INSTALL_DIR/lib/libz.a" \
        -DHDF5_C_LIBRARY_hdf5="$INSTALL_DIR/lib/libhdf5.a" \
        -DHDF5_HL_LIBRARY="$INSTALL_DIR/lib/libhdf5_hl.a;$INSTALL_DIR/lib/libz.a" \
        -DHDF5_VERSION="$HDF5_VERSION" \
        -DHDF5_VERSION_STRING="$HDF5_VERSION" \
        -DHAVE_HDF5_H="$INSTALL_DIR/include" \
        -DHAVE_HDF5_ZLIB=ON \
        -DHDF5_IS_PARALLEL_MPIO=OFF \
        -DHDF5_PARALLEL=OFF \
        -DUSE_HDF5_SZIP=OFF \
        -DZLIB_INCLUDE_DIR="$INSTALL_DIR/include" \
        -DZLIB_LIBRARY="$INSTALL_DIR/lib/libz.a"
    
    # Apply config.h patches after CMake configuration
    apply_config_patches "$(pwd)/config.h"
    
    log "Building NetCDF4 with emmake..."
    check_command emmake make -j1 AR=emar ARFLAGS=rcs RANLIB=emranlib
    
    log "Installing NetCDF4..."
    check_command emmake make install
    
    log "✅ NetCDF4 built and installed successfully"
    
    # Verify installation
    if [ -f "$INSTALL_DIR/lib/libnetcdf.a" ]; then
        log "✅ NetCDF4 library verified at $INSTALL_DIR/lib/libnetcdf.a"
    else
        error_exit "NetCDF4 library not found after installation"
    fi
else
    log "✅ NetCDF4 already built and installed"
fi

# Create WASM module
log "Starting WASM module creation..."
cd "$BUILD_DIR"
log "Changed to build directory: $(pwd)"

# Create a simple C wrapper that exposes NetCDF functions
cat > netcdf_wrapper.c << 'EOF'
#include <netcdf.h>
#include <emscripten.h>

// =========================
// NetCDF File Operations
// =========================
EMSCRIPTEN_KEEPALIVE
int nc_open_wrapper(const char* path, int mode, int* ncidp) {
    return nc_open(path, mode, ncidp);
}

EMSCRIPTEN_KEEPALIVE
int nc_close_wrapper(int ncid) {
    return nc_close(ncid);
}

EMSCRIPTEN_KEEPALIVE
int nc_create_wrapper(const char* path, int mode, int* ncidp) {
    return nc_create(path, mode, ncidp);
}

EMSCRIPTEN_KEEPALIVE
int nc_enddef_wrapper(int ncid) {
    return nc_enddef(ncid);
}

EMSCRIPTEN_KEEPALIVE
int nc_redef_wrapper(int ncid) {
    return nc_redef(ncid);
}

EMSCRIPTEN_KEEPALIVE
int nc_sync_wrapper(int ncid) {
    return nc_sync(ncid);
}

EMSCRIPTEN_KEEPALIVE
int nc_abort_wrapper(int ncid) {
    return nc_abort(ncid);
}

EMSCRIPTEN_KEEPALIVE
int nc_set_fill_wrapper(int ncid, int fillmode, int* old_modep) {
    return nc_set_fill(ncid, fillmode, old_modep);
}

// =========================
// Dimensions
// =========================
EMSCRIPTEN_KEEPALIVE
int nc_def_dim_wrapper(int ncid, const char* name, size_t len, int* dimidp) {
    return nc_def_dim(ncid, name, len, dimidp);
}

EMSCRIPTEN_KEEPALIVE
int nc_inq_ndims_wrapper(int ncid, int* ndims) {
    return nc_inq_ndims(ncid, ndims);
}

EMSCRIPTEN_KEEPALIVE
int nc_inq_unlimdim_wrapper(int ncid, int* unlimdimid) {
    return nc_inq_unlimdim(ncid, unlimdimid);
}

EMSCRIPTEN_KEEPALIVE
int nc_inq_dimids_wrapper(int ncid, int* ndims, int* dimids, int include_parents) {
    return nc_inq_dimids(ncid, ndims, dimids, include_parents);
}

EMSCRIPTEN_KEEPALIVE
int nc_inq_dim_wrapper(int ncid, int dimid, char* name, size_t* lenp) {
    return nc_inq_dim(ncid, dimid, name, lenp);
}

EMSCRIPTEN_KEEPALIVE
int nc_inq_dimid_wrapper(int ncid, const char* name, int* dimidp) {
    return nc_inq_dimid(ncid, name, dimidp);
}

EMSCRIPTEN_KEEPALIVE
int nc_inq_dimlen_wrapper(int ncid, int dimid, size_t* lenp) {
    return nc_inq_dimlen(ncid, dimid, lenp);
}

EMSCRIPTEN_KEEPALIVE
int nc_inq_dimname_wrapper(int ncid, int dimid, char* name) {
    return nc_inq_dimname(ncid, dimid, name);
}

EMSCRIPTEN_KEEPALIVE
int nc_rename_dim_wrapper(int ncid, int dimid, const char* name) {
    return nc_rename_dim(ncid, dimid, name);
}

// =========================
// Variables
// =========================
EMSCRIPTEN_KEEPALIVE
int nc_def_var_wrapper(int ncid, const char* name, nc_type xtype, int ndims, const int* dimidsp, int* varidp) {
    return nc_def_var(ncid, name, xtype, ndims, dimidsp, varidp);
}

EMSCRIPTEN_KEEPALIVE
int nc_inq_nvars_wrapper(int ncid, int* nvars) {
    return nc_inq_nvars(ncid, nvars);
}

EMSCRIPTEN_KEEPALIVE
int nc_inq_varids_wrapper(int ncid, int* nvars, int* varids) {
    return nc_inq_varids(ncid, nvars, varids);
}

EMSCRIPTEN_KEEPALIVE
int nc_inq_varid_wrapper(int ncid, const char* name, int* varidp) {
    return nc_inq_varid(ncid, name, varidp);
}

EMSCRIPTEN_KEEPALIVE
int nc_inq_var_wrapper(int ncid, int varid, char* name, nc_type* xtypep, int* ndims, int* dimids, int* nattsp) {
    return nc_inq_var(ncid, varid, name, xtypep, ndims, dimids, nattsp);
}

EMSCRIPTEN_KEEPALIVE
int nc_inq_varname_wrapper(int ncid, int varid, char* name) {
    return nc_inq_varname(ncid, varid, name);
}

EMSCRIPTEN_KEEPALIVE
int nc_inq_vartype_wrapper(int ncid, int varid, nc_type* xtypep) {
    return nc_inq_vartype(ncid, varid, xtypep);
}

EMSCRIPTEN_KEEPALIVE
int nc_inq_varndims_wrapper(int ncid, int varid, int* ndims) {
    return nc_inq_varndims(ncid, varid, ndims);
}

EMSCRIPTEN_KEEPALIVE
int nc_inq_vardimid_wrapper(int ncid, int varid, int* dimids) {
    return nc_inq_vardimid(ncid, varid, dimids);
}

EMSCRIPTEN_KEEPALIVE
int nc_inq_varnatts_wrapper(int ncid, int varid, int* nattsp) {
    return nc_inq_varnatts(ncid, varid, nattsp);
}

EMSCRIPTEN_KEEPALIVE
int nc_rename_var_wrapper(int ncid, int varid, const char* name) {
    return nc_rename_var(ncid, varid, name);
}

EMSCRIPTEN_KEEPALIVE
int nc_inq_var_chunking_wrapper(int ncid, int varid, int* storagep, size_t* chunksizesp) {
    return nc_inq_var_chunking(ncid, varid, storagep, chunksizesp);
}

EMSCRIPTEN_KEEPALIVE
int nc_def_var_chunking_wrapper(int ncid, int varid, int storage, const size_t* chunksizesp) {
    return nc_def_var_chunking(ncid, varid, storage, chunksizesp);
}

EMSCRIPTEN_KEEPALIVE
int nc_inq_var_deflate_wrapper(int ncid, int varid, int* shufflep, int* deflatep, int* deflate_levelp) {
    return nc_inq_var_deflate(ncid, varid, shufflep, deflatep, deflate_levelp);
}

EMSCRIPTEN_KEEPALIVE
int nc_def_var_deflate_wrapper(int ncid, int varid, int shuffle, int deflate, int deflate_level) {
    return nc_def_var_deflate(ncid, varid, shuffle, deflate, deflate_level);
}

EMSCRIPTEN_KEEPALIVE
int nc_inq_var_fill_wrapper(int ncid, int varid, int* no_fill, void* fill_valuep) {
    return nc_inq_var_fill(ncid, varid, no_fill, fill_valuep);
}

EMSCRIPTEN_KEEPALIVE
int nc_def_var_fill_wrapper(int ncid, int varid, int no_fill, const void* fill_value) {
    return nc_def_var_fill(ncid, varid, no_fill, fill_value);
}

EMSCRIPTEN_KEEPALIVE
int nc_inq_var_endian_wrapper(int ncid, int varid, int* endianp) {
    return nc_inq_var_endian(ncid, varid, endianp);
}

EMSCRIPTEN_KEEPALIVE
int nc_def_var_endian_wrapper(int ncid, int varid, int endian) {
    return nc_def_var_endian(ncid, varid, endian);
}

// =========================
// Attributes
// =========================
EMSCRIPTEN_KEEPALIVE
int nc_inq_natts_wrapper(int ncid, int* nattsp) {
    return nc_inq_natts(ncid, nattsp);
}

EMSCRIPTEN_KEEPALIVE
int nc_inq_att_wrapper(int ncid, int varid, const char* name, nc_type* xtypep, size_t* lenp) {
    return nc_inq_att(ncid, varid, name, xtypep, lenp);
}

EMSCRIPTEN_KEEPALIVE
int nc_inq_attid_wrapper(int ncid, int varid, const char* name, int* attidp) {
    return nc_inq_attid(ncid, varid, name, attidp);
}

EMSCRIPTEN_KEEPALIVE
int nc_inq_attname_wrapper(int ncid, int varid, int attid, char* name) {
    return nc_inq_attname(ncid, varid, attid, name);
}

EMSCRIPTEN_KEEPALIVE
int nc_inq_atttype_wrapper(int ncid, int varid, const char* name, nc_type* xtypep) {
    return nc_inq_atttype(ncid, varid, name, xtypep);
}

EMSCRIPTEN_KEEPALIVE
int nc_inq_attlen_wrapper(int ncid, int varid, const char* name, size_t* lenp) {
    return nc_inq_attlen(ncid, varid, name, lenp);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_att_text_wrapper(int ncid, int varid, const char* name, char* value) {
    return nc_get_att_text(ncid, varid, name, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_att_uchar_wrapper(int ncid, int varid, const char* name, unsigned char* value) {
    return nc_get_att_uchar(ncid, varid, name, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_att_schar_wrapper(int ncid, int varid, const char* name, signed char* value) {
    return nc_get_att_schar(ncid, varid, name, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_att_short_wrapper(int ncid, int varid, const char* name, short* value) {
    return nc_get_att_short(ncid, varid, name, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_att_int_wrapper(int ncid, int varid, const char* name, int* value) {
    return nc_get_att_int(ncid, varid, name, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_att_long_wrapper(int ncid, int varid, const char* name, long* value) {
    return nc_get_att_long(ncid, varid, name, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_att_float_wrapper(int ncid, int varid, const char* name, float* value) {
    return nc_get_att_float(ncid, varid, name, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_att_double_wrapper(int ncid, int varid, const char* name, double* value) {
    return nc_get_att_double(ncid, varid, name, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_att_ushort_wrapper(int ncid, int varid, const char* name, unsigned short* value) {
    return nc_get_att_ushort(ncid, varid, name, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_att_uint_wrapper(int ncid, int varid, const char* name, unsigned int* value) {
    return nc_get_att_uint(ncid, varid, name, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_att_longlong_wrapper(int ncid, int varid, const char* name, long long* value) {
    return nc_get_att_longlong(ncid, varid, name, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_att_ulonglong_wrapper(int ncid, int varid, const char* name, unsigned long long* value) {
    return nc_get_att_ulonglong(ncid, varid, name, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_put_att_text_wrapper(int ncid, int varid, const char* name, size_t len, const char* value) {
    return nc_put_att_text(ncid, varid, name, len, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_put_att_short_wrapper(int ncid, int varid, const char* name, nc_type xtype, size_t len, const short* value) {
    return nc_put_att_short(ncid, varid, name, xtype, len, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_put_att_int_wrapper(int ncid, int varid, const char* name, nc_type xtype, size_t len, const int* value) {
    return nc_put_att_int(ncid, varid, name, xtype, len, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_put_att_float_wrapper(int ncid, int varid, const char* name, nc_type xtype, size_t len, const float* value) {
    return nc_put_att_float(ncid, varid, name, xtype, len, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_put_att_double_wrapper(int ncid, int varid, const char* name, nc_type xtype, size_t len, const double* value) {
    return nc_put_att_double(ncid, varid, name, xtype, len, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_del_att_wrapper(int ncid, int varid, const char* name) {
    return nc_del_att(ncid, varid, name);
}

EMSCRIPTEN_KEEPALIVE
int nc_rename_att_wrapper(int ncid, int varid, const char* name, const char* newname) {
    return nc_rename_att(ncid, varid, name, newname);
}

// =========================
// Data Access (Reading)
// =========================
EMSCRIPTEN_KEEPALIVE
int nc_get_vara_text_wrapper(int ncid, int varid, const size_t* start, const size_t* count, char* value) {
    return nc_get_vara_text(ncid, varid, start, count, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_vara_uchar_wrapper(int ncid, int varid, const size_t* start, const size_t* count, unsigned char* value) {
    return nc_get_vara_uchar(ncid, varid, start, count, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_vara_schar_wrapper(int ncid, int varid, const size_t* start, const size_t* count, signed char* value) {
    return nc_get_vara_schar(ncid, varid, start, count, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_vara_short_wrapper(int ncid, int varid, const size_t* start, const size_t* count, short* value) {
    return nc_get_vara_short(ncid, varid, start, count, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_vara_int_wrapper(int ncid, int varid, const size_t* start, const size_t* count, int* value) {
    return nc_get_vara_int(ncid, varid, start, count, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_vara_long_wrapper(int ncid, int varid, const size_t* start, const size_t* count, long* value) {
    return nc_get_vara_long(ncid, varid, start, count, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_vara_float_wrapper(int ncid, int varid, const size_t* start, const size_t* count, float* value) {
    return nc_get_vara_float(ncid, varid, start, count, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_vara_double_wrapper(int ncid, int varid, const size_t* start, const size_t* count, double* value) {
    return nc_get_vara_double(ncid, varid, start, count, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_vara_ushort_wrapper(int ncid, int varid, const size_t* start, const size_t* count, unsigned short* value) {
    return nc_get_vara_ushort(ncid, varid, start, count, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_vara_uint_wrapper(int ncid, int varid, const size_t* start, const size_t* count, unsigned int* value) {
    return nc_get_vara_uint(ncid, varid, start, count, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_vara_longlong_wrapper(int ncid, int varid, const size_t* start, const size_t* count, long long* value) {
    return nc_get_vara_longlong(ncid, varid, start, count, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_vara_ulonglong_wrapper(int ncid, int varid, const size_t* start, const size_t* count, unsigned long long* value) {
    return nc_get_vara_ulonglong(ncid, varid, start, count, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_var_text_wrapper(int ncid, int varid, char* value) {
    return nc_get_var_text(ncid, varid, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_var_uchar_wrapper(int ncid, int varid, unsigned char* value) {
    return nc_get_var_uchar(ncid, varid, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_var_schar_wrapper(int ncid, int varid, signed char* value) {
    return nc_get_var_schar(ncid, varid, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_var_short_wrapper(int ncid, int varid, short* value) {
    return nc_get_var_short(ncid, varid, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_var_int_wrapper(int ncid, int varid, int* value) {
    return nc_get_var_int(ncid, varid, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_var_long_wrapper(int ncid, int varid, long* value) {
    return nc_get_var_long(ncid, varid, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_var_float_wrapper(int ncid, int varid, float* value) {
    return nc_get_var_float(ncid, varid, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_var_double_wrapper(int ncid, int varid, double* value) {
    return nc_get_var_double(ncid, varid, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_var_ushort_wrapper(int ncid, int varid, unsigned short* value) {
    return nc_get_var_ushort(ncid, varid, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_var_uint_wrapper(int ncid, int varid, unsigned int* value) {
    return nc_get_var_uint(ncid, varid, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_var_longlong_wrapper(int ncid, int varid, long long* value) {
    return nc_get_var_longlong(ncid, varid, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_var_ulonglong_wrapper(int ncid, int varid, unsigned long long* value) {
    return nc_get_var_ulonglong(ncid, varid, value);
}

// =========================
// Data Writing
// =========================
EMSCRIPTEN_KEEPALIVE
int nc_put_vara_text_wrapper(int ncid, int varid, const size_t* start, const size_t* count, const char* value) {
    return nc_put_vara_text(ncid, varid, start, count, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_put_vara_uchar_wrapper(int ncid, int varid, const size_t* start, const size_t* count, const unsigned char* value) {
    return nc_put_vara_uchar(ncid, varid, start, count, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_put_vara_schar_wrapper(int ncid, int varid, const size_t* start, const size_t* count, const signed char* value) {
    return nc_put_vara_schar(ncid, varid, start, count, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_put_vara_short_wrapper(int ncid, int varid, const size_t* start, const size_t* count, const short* value) {
    return nc_put_vara_short(ncid, varid, start, count, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_put_vara_int_wrapper(int ncid, int varid, const size_t* start, const size_t* count, const int* value) {
    return nc_put_vara_int(ncid, varid, start, count, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_put_vara_long_wrapper(int ncid, int varid, const size_t* start, const size_t* count, const long* value) {
    return nc_put_vara_long(ncid, varid, start, count, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_put_vara_float_wrapper(int ncid, int varid, const size_t* start, const size_t* count, const float* value) {
    return nc_put_vara_float(ncid, varid, start, count, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_put_vara_double_wrapper(int ncid, int varid, const size_t* start, const size_t* count, const double* value) {
    return nc_put_vara_double(ncid, varid, start, count, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_put_vara_ushort_wrapper(int ncid, int varid, const size_t* start, const size_t* count, const unsigned short* value) {
    return nc_put_vara_ushort(ncid, varid, start, count, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_put_vara_uint_wrapper(int ncid, int varid, const size_t* start, const size_t* count, const unsigned int* value) {
    return nc_put_vara_uint(ncid, varid, start, count, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_put_vara_longlong_wrapper(int ncid, int varid, const size_t* start, const size_t* count, const long long* value) {
    return nc_put_vara_longlong(ncid, varid, start, count, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_put_vara_ulonglong_wrapper(int ncid, int varid, const size_t* start, const size_t* count, const unsigned long long* value) {
    return nc_put_vara_ulonglong(ncid, varid, start, count, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_put_var_text_wrapper(int ncid, int varid, const char* value) {
    return nc_put_var_text(ncid, varid, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_put_var_uchar_wrapper(int ncid, int varid, const unsigned char* value) {
    return nc_put_var_uchar(ncid, varid, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_put_var_schar_wrapper(int ncid, int varid, const signed char* value) {
    return nc_put_var_schar(ncid, varid, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_put_var_short_wrapper(int ncid, int varid, const short* value) {
    return nc_put_var_short(ncid, varid, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_put_var_int_wrapper(int ncid, int varid, const int* value) {
    return nc_put_var_int(ncid, varid, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_put_var_long_wrapper(int ncid, int varid, const long* value) {
    return nc_put_var_long(ncid, varid, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_put_var_float_wrapper(int ncid, int varid, const float* value) {
    return nc_put_var_float(ncid, varid, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_put_var_double_wrapper(int ncid, int varid, const double* value) {
    return nc_put_var_double(ncid, varid, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_put_var_ushort_wrapper(int ncid, int varid, const unsigned short* value) {
    return nc_put_var_ushort(ncid, varid, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_put_var_uint_wrapper(int ncid, int varid, const unsigned int* value) {
    return nc_put_var_uint(ncid, varid, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_put_var_longlong_wrapper(int ncid, int varid, const long long* value) {
    return nc_put_var_longlong(ncid, varid, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_put_var_ulonglong_wrapper(int ncid, int varid, const unsigned long long* value) {
    return nc_put_var_ulonglong(ncid, varid, value);
}

EOF

# Compile to WASM
log "Creating C wrapper for NetCDF functions..."

log "Compiling WASM module with emcc..."
check_command emcc netcdf_wrapper.c \
    -I"$INSTALL_DIR/include" \
    -L"$INSTALL_DIR/lib" \
    -lnetcdf -lhdf5 -lhdf5_hl -lz \
    -lworkerfs.js \
    -s WASM=1 \
    -s MODULARIZE=1 \
    -s EXPORT_ES6=1 \
    -s ENVIRONMENT=web,worker \
    -s EXPORT_NAME="NetCDF4Module" \
    -s FORCE_FILESYSTEM=1 \
    -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","getValue","setValue","UTF8ToString","stringToUTF8","lengthBytesUTF8","FS","WORKERFS","cwrap","ccall","HEAP8","HEAP16","HEAP32","HEAPF32","HEAPF64","HEAP64","HEAPU8","HEAPU16","HEAPU32"]' \
    -s EXPORTED_FUNCTIONS='["_malloc","_free"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=16777216 \
    --pre-js "$PROJECT_ROOT/bindings/pre.js" \
    --post-js "$PROJECT_ROOT/bindings/post.js" \
    -O2 \
    -o "$DIST_DIR/netcdf4-wasm.js"

log "✅ WASM module created successfully!"

# Verify build outputs
if [ -f "$DIST_DIR/netcdf4-wasm.js" ] && [ -f "$DIST_DIR/netcdf4-wasm.wasm" ]; then
    log "✅ Build verification successful!"
    log "Built files:"
    log "  - $DIST_DIR/netcdf4-wasm.js ($(du -h "$DIST_DIR/netcdf4-wasm.js" | cut -f1))"
    log "  - $DIST_DIR/netcdf4-wasm.wasm ($(du -h "$DIST_DIR/netcdf4-wasm.wasm" | cut -f1))"
else
    error_exit "WASM build files not found after compilation"
fi

log "🎉 NetCDF4 WASM build completed successfully!"
log "You can now use the TypeScript interface to interact with NetCDF files."