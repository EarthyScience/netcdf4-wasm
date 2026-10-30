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
ZLIB_VERSION="1.3.2"
HDF5_VERSION="2.2.0"
ZSTD_VERSION="1.5.7"
BLOSC_VERSION="1.21.6"
NETCDF_VERSION="4.10.1"

# Download URLs
ZLIB_URL="https://zlib.net/zlib-${ZLIB_VERSION}.tar.gz"
HDF5_URL="https://github.com/HDFGroup/hdf5/archive/refs/tags/${HDF5_VERSION}.tar.gz"
ZSTD_URL="https://github.com/facebook/zstd/releases/download/v${ZSTD_VERSION}/zstd-${ZSTD_VERSION}.tar.gz"
BLOSC_URL="https://github.com/Blosc/c-blosc/archive/refs/tags/v${BLOSC_VERSION}.tar.gz"
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

# Function to download a URL to a file with wget or curl
download() {
    if command -v wget &> /dev/null; then
        check_command wget -v "$1" -O "$2"
    elif command -v curl &> /dev/null; then
        check_command curl -L "$1" -o "$2"
    else
        error_exit "Neither wget nor curl available for downloading"
    fi
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

# Print the version an installed header records (sed -E expression in $2), or nothing if it is missing
installed_version() {
    local header="$INSTALL_DIR/include/$1"
    if [ -f "$header" ]; then
        sed -nE "$2" "$header" | paste -sd. -
    fi
}

# Start from an empty install directory when a dependency is missing or from
# a different version, since everything above it was built against it
REQUIRED_VERSIONS="zlib $ZLIB_VERSION, HDF5 $HDF5_VERSION, zstd $ZSTD_VERSION, c-blosc $BLOSC_VERSION"
if [ -d "$INSTALL_DIR/include" ]; then
    INSTALLED_VERSIONS="zlib $(installed_version zlib.h 's/^#define ZLIB_VERSION +"(.*)"/\1/p')"
    INSTALLED_VERSIONS+=", HDF5 $(installed_version H5public.h 's/^#define H5_VERS_(MAJOR|MINOR|RELEASE) +([0-9]+).*/\2/p')"
    INSTALLED_VERSIONS+=", zstd $(installed_version zstd.h 's/^#define ZSTD_VERSION_(MAJOR|MINOR|RELEASE) +([0-9]+).*/\2/p')"
    INSTALLED_VERSIONS+=", c-blosc $(installed_version blosc.h 's/^#define BLOSC_VERSION_STRING +"([^"]*)".*/\1/p')"
    if [ "$INSTALLED_VERSIONS" != "$REQUIRED_VERSIONS" ]; then
        log "Installed dependencies ($INSTALLED_VERSIONS) differ from $REQUIRED_VERSIONS, clearing $INSTALL_DIR..."
        rm -rf "$INSTALL_DIR"
    fi
fi

# Create directories
log "Creating build directories..."
mkdir -p "$BUILD_DIR" "$DIST_DIR" "$DEPS_DIR" "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR/lib/netcdf/plugins"  # placholder, create plugin directory for additional filters

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
    
    log "zlib built and installed successfully"
    
    # Verify installation
    if [ -f "$INSTALL_DIR/lib/libz.a" ]; then
        log "zlib library verified at $INSTALL_DIR/lib/libz.a"
    else
        error_exit "zlib library not found after installation"
    fi
else
    log "zlib already built and installed"
fi

# Build HDF5
log "Starting HDF5 build process..."
if [ ! -f "$INSTALL_DIR/lib/libhdf5.a" ]; then
    log "HDF5 not found, building from source..."
    cd "$DEPS_DIR"
    log "Changed to deps directory: $(pwd)"
    
    if [ ! -d "hdf5-$HDF5_VERSION" ]; then
        log "Downloading HDF5-$HDF5_VERSION..."
        
        HDF5_DOWNLOAD_NAME="hdf5-$HDF5_VERSION.tar.gz"
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
        # HDF5 2.x tags are plain versions, so the archive extracts to hdf5-$HDF5_VERSION
        check_command tar -xzf "$HDF5_DOWNLOAD_NAME"
        log "HDF5 extracted successfully"
    else
        log "HDF5 source directory already exists"
    fi
    
    cd "hdf5-$HDF5_VERSION"
    log "Configuring HDF5 in directory: $(pwd)"
    rm -rf build
    mkdir -p build && cd build
    
    log "Running emcmake cmake for HDF5 with FILTER SUPPORT..."

    # Set environment variables to help CMake find zlib
    export ZLIB_ROOT="$INSTALL_DIR"
    export ZLIB_INCLUDE_DIR="$INSTALL_DIR/include"
    export ZLIB_LIBRARY="$INSTALL_DIR/lib/libz.a"

    check_command emcmake cmake .. \
        -DCMAKE_INSTALL_PREFIX="$INSTALL_DIR" \
        -DCMAKE_BUILD_TYPE=Release \
        -DCMAKE_PREFIX_PATH="$INSTALL_DIR" \
        -DCMAKE_FIND_ROOT_PATH="$INSTALL_DIR" \
        -DBUILD_SHARED_LIBS=OFF \
        -DBUILD_STATIC_LIBS=ON \
        -DHDF5_ENABLE_THREADSAFE=OFF \
        -DHDF5_ENABLE_PARALLEL=OFF \
        -DHDF5_BUILD_HL_LIB=ON \
        -DHDF5_BUILD_TOOLS=OFF \
        -DHDF5_BUILD_EXAMPLES=OFF \
        -DBUILD_TESTING=OFF \
        -DCMAKE_C_BYTE_ORDER=LITTLE_ENDIAN \
        -DHDF5_ENABLE_ZLIB_SUPPORT=ON \
        -DHDF5_USE_ZLIB_STATIC=ON \
        -DHDF5_ENABLE_SZIP_SUPPORT=OFF \
        -DZLIB_ROOT="$INSTALL_DIR" \
        -DZLIB_INCLUDE_DIR="$INSTALL_DIR/include" \
        -DZLIB_LIBRARY="$INSTALL_DIR/lib/libz.a" \
        -DBUILD_STATIC_EXECS=OFF
    
    log "Building HDF5 with emmake..."
    check_command emmake make -j1 AR=emar ARFLAGS=rcs RANLIB=emranlib
    
    log "Installing HDF5..."
    check_command emmake make install
    
    log "HDF5 built and installed successfully"
    
    # Verify installation
    if [ -f "$INSTALL_DIR/lib/libhdf5.a" ]; then
        log "HDF5 library verified at $INSTALL_DIR/lib/libhdf5.a"
    else
        error_exit "HDF5 library not found after installation"
    fi
    
    # Verify HDF5 High-Level library (required by NetCDF)
    if [ -f "$INSTALL_DIR/lib/libhdf5_hl.a" ]; then
        log "HDF5 High-Level library verified at $INSTALL_DIR/lib/libhdf5_hl.a"
    else
        error_exit "HDF5 High-Level library not found - NetCDF requires this!"
    fi
else
    log "HDF5 already built and installed"
fi

# Build zstd (for the Zstandard filter, and used by c-blosc)
log "Starting zstd build process..."
if [ ! -f "$INSTALL_DIR/lib/libzstd.a" ]; then
    log "zstd not found, building from source..."
    cd "$DEPS_DIR"

    if [ ! -d "zstd-$ZSTD_VERSION" ]; then
        log "Downloading zstd-$ZSTD_VERSION..."
        download "$ZSTD_URL" "zstd-$ZSTD_VERSION.tar.gz"
        check_command tar -xzf "zstd-$ZSTD_VERSION.tar.gz"
    fi

    cd "zstd-$ZSTD_VERSION"
    rm -rf build-wasm
    mkdir -p build-wasm && cd build-wasm

    log "Running emcmake cmake for zstd..."
    check_command emcmake cmake ../build/cmake \
        -DCMAKE_INSTALL_PREFIX="$INSTALL_DIR" \
        -DCMAKE_BUILD_TYPE=Release \
        -DZSTD_BUILD_STATIC=ON \
        -DZSTD_BUILD_SHARED=OFF \
        -DZSTD_BUILD_PROGRAMS=OFF \
        -DZSTD_BUILD_TESTS=OFF \
        -DZSTD_MULTITHREAD_SUPPORT=OFF \
        -DZSTD_LEGACY_SUPPORT=OFF

    log "Building zstd with emmake..."
    check_command emmake make -j1 AR=emar ARFLAGS=rcs RANLIB=emranlib
    check_command emmake make install

    if [ ! -f "$INSTALL_DIR/lib/libzstd.a" ]; then
        error_exit "zstd library not found after installation"
    fi
    log "zstd built and installed successfully"
else
    log "zstd already built and installed"
fi

# Build c-blosc (for the Blosc filter)
log "Starting c-blosc build process..."
if [ ! -f "$INSTALL_DIR/lib/libblosc.a" ]; then
    log "c-blosc not found, building from source..."
    cd "$DEPS_DIR"

    if [ ! -d "c-blosc-$BLOSC_VERSION" ]; then
        log "Downloading c-blosc-$BLOSC_VERSION..."
        download "$BLOSC_URL" "c-blosc-$BLOSC_VERSION.tar.gz"
        check_command tar -xzf "c-blosc-$BLOSC_VERSION.tar.gz"
    fi

    cd "c-blosc-$BLOSC_VERSION"
    rm -rf build
    mkdir -p build && cd build

    # Use the zlib and zstd built above (LZ4 is bundled with c-blosc). The x86
    # SIMD code paths don't apply to WebAssembly. CMAKE_POLICY_VERSION_MINIMUM
    # lets CMake 4 accept c-blosc's old cmake_minimum_required.
    log "Running emcmake cmake for c-blosc..."
    check_command emcmake cmake .. \
        -DCMAKE_INSTALL_PREFIX="$INSTALL_DIR" \
        -DCMAKE_BUILD_TYPE=Release \
        -DCMAKE_PREFIX_PATH="$INSTALL_DIR" \
        -DCMAKE_FIND_ROOT_PATH="$INSTALL_DIR" \
        -DCMAKE_POLICY_VERSION_MINIMUM=3.5 \
        -DBUILD_STATIC=ON \
        -DBUILD_SHARED=OFF \
        -DBUILD_TESTS=OFF \
        -DBUILD_FUZZERS=OFF \
        -DBUILD_BENCHMARKS=OFF \
        -DDEACTIVATE_SSE2=ON \
        -DDEACTIVATE_AVX2=ON \
        -DPREFER_EXTERNAL_ZLIB=ON \
        -DPREFER_EXTERNAL_ZSTD=ON \
        -DZLIB_INCLUDE_DIR="$INSTALL_DIR/include" \
        -DZLIB_LIBRARY="$INSTALL_DIR/lib/libz.a" \
        -DZSTD_INCLUDE_DIR="$INSTALL_DIR/include" \
        -DZSTD_LIBRARY="$INSTALL_DIR/lib/libzstd.a"

    log "Building c-blosc with emmake..."
    check_command emmake make -j1 AR=emar ARFLAGS=rcs RANLIB=emranlib
    check_command emmake make install

    if [ ! -f "$INSTALL_DIR/lib/libblosc.a" ]; then
        error_exit "c-blosc library not found after installation"
    fi
    log "c-blosc built and installed successfully"
else
    log "c-blosc already built and installed"
fi

# Build NetCDF4
log "Starting NetCDF4 build process..."
# Rebuild when the installed libraries are missing or from a different NetCDF version
INSTALLED_NETCDF_VERSION=""
if [ -f "$INSTALL_DIR/include/netcdf_meta.h" ]; then
    INSTALLED_NETCDF_VERSION=$(sed -n 's/^#define NC_VERSION *"\(.*\)"/\1/p' "$INSTALL_DIR/include/netcdf_meta.h")
fi
if [ ! -f "$INSTALL_DIR/lib/libnetcdf.a" ] || [ ! -f "$INSTALL_DIR/lib/libh5filters.a" ] ||
   [ "$INSTALLED_NETCDF_VERSION" != "$NETCDF_VERSION" ]; then
    log "NetCDF4 $NETCDF_VERSION not found (installed: ${INSTALLED_NETCDF_VERSION:-none}), building from source..."
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

    # Start from a clean build directory so no stale CMake cache is reused
    rm -rf build
    mkdir -p build && cd build

    # HDF5 2.x's exported targets link against ZLIB::ZLIB, but NetCDF's bundled
    # FindZLIB.cmake doesn't define that target, so provide it before NetCDF's
    # own CMake code runs
    cat > zlib-target.cmake << EOF
if(NOT TARGET ZLIB::ZLIB)
  add_library(ZLIB::ZLIB STATIC IMPORTED GLOBAL)
  set_target_properties(ZLIB::ZLIB PROPERTIES
    IMPORTED_LOCATION "$INSTALL_DIR/lib/libz.a"
    INTERFACE_INCLUDE_DIRECTORIES "$INSTALL_DIR/include")
endif()
EOF

    # HDF5 and its zlib dependency are located through the hdf5-config.cmake
    # installed above; type sizes and endianness are detected by Emscripten's
    # CMake modules, so no patching of CMakeLists.txt or config.h is needed.
    # Emscripten ships <sys/xattr.h> without getxattr/listxattr, so turn off
    # the xattr and getfattr probes NetCDF uses to detect DAOS containers.
    log "Running emcmake cmake for NetCDF4..."
    check_command emcmake cmake .. \
        -DCMAKE_PROJECT_INCLUDE="$(pwd)/zlib-target.cmake" \
        -DCMAKE_INSTALL_PREFIX="$INSTALL_DIR" \
        -DCMAKE_BUILD_TYPE=Release \
        -DCMAKE_PREFIX_PATH="$INSTALL_DIR" \
        -DCMAKE_FIND_ROOT_PATH="$INSTALL_DIR" \
        -DBUILD_SHARED_LIBS=OFF \
        -DBUILD_TESTING=OFF \
        -DNETCDF_ENABLE_TESTS=OFF \
        -DNETCDF_BUILD_UTILITIES=OFF \
        -DNETCDF_ENABLE_HDF5=ON \
        -DHDF5_USE_STATIC_LIBRARIES=ON \
        -DNETCDF_ENABLE_DAP=OFF \
        -DNETCDF_ENABLE_BYTERANGE=OFF \
        -DNETCDF_ENABLE_NCZARR=ON \
        -DHAVE_SYS_XATTR_H=OFF \
        -DGETFATTR=GETFATTR-NOTFOUND \
        -DBlosc_ROOT="$INSTALL_DIR" \
        -DZstd_ROOT="$INSTALL_DIR" \
        -DZLIB_INCLUDE_DIR="$INSTALL_DIR/include" \
        -DZLIB_LIBRARY="$INSTALL_DIR/lib/libz.a"

    log "Building NetCDF4 with emmake..."
    check_command emmake make -j1 AR=emar ARFLAGS=rcs RANLIB=emranlib
    
    log "Installing NetCDF4..."
    check_command emmake make install

    log "NetCDF4 built and installed successfully"

    # NetCDF ships the Blosc, Zstandard and bzip2 HDF5 filters as plugins for
    # HDF5 to load at runtime, which WebAssembly can't do. Compile them into a
    # static library instead; the WASM module registers them on startup. Each
    # plugin defines the same H5PLget_plugin_* entry points, so rename those.
    log "Building HDF5 compression filters (Blosc, Zstandard, bzip2)..."
    FILTER_OBJ_DIR="$(pwd)/h5filters"
    mkdir -p "$FILTER_OBJ_DIR"
    FILTER_CFLAGS=(-O2 -DHAVE_CONFIG_H -I"$(pwd)" -I"$(pwd)/include" -I../include -I../plugins -I"$INSTALL_DIR/include")
    for filter in blosc zstd bzip2; do
        check_command emcc "${FILTER_CFLAGS[@]}" \
            -DH5PLget_plugin_type="${filter}_plugin_type" \
            -DH5PLget_plugin_info="${filter}_plugin_info" \
            -c "../plugins/H5Z$filter.c" -o "$FILTER_OBJ_DIR/H5Z$filter.o"
    done
    # bzip2 itself is bundled with the NetCDF sources
    for source in blocksort bzlib compress crctable decompress huffman randtable; do
        check_command emcc "${FILTER_CFLAGS[@]}" -c "../plugins/$source.c" -o "$FILTER_OBJ_DIR/$source.o"
    done
    rm -f "$INSTALL_DIR/lib/libh5filters.a"
    check_command emar rcs "$INSTALL_DIR/lib/libh5filters.a" "$FILTER_OBJ_DIR"/*.o
    
    # Verify installation
    if [ -f "$INSTALL_DIR/lib/libnetcdf.a" ]; then
        log "NetCDF4 library verified at $INSTALL_DIR/lib/libnetcdf.a"
        
        # Verify filter support
        log "Verifying filter support..."
        if [ -d "$INSTALL_DIR/lib/netcdf/plugins" ]; then
            log "Plugin directory exists at $INSTALL_DIR/lib/netcdf/plugins"
        else
            log "Warning: Plugin directory not found (may be expected if no plugins built)"
        fi
        
        # Check for filter-related headers
        if grep -q "H5Z_FILTER_SHUFFLE" "$INSTALL_DIR/include/H5Zpublic.h" 2>/dev/null; then
            log "Shuffle filter support detected in HDF5 headers"
        else
            log "Warning: Shuffle filter support not detected in headers"
        fi
    else
        error_exit "NetCDF4 library not found after installation"
    fi
else
    log "NetCDF4 already built and installed"
fi

# Create WASM module
log "Starting WASM module creation..."
log "Filter support configuration complete:"
log "  - HDF5 built-in filters: shuffle, fletcher32, deflate (via zlib)"
log "  - Statically linked filters: Blosc (32001), Zstandard (32015), bzip2 (307)"
log "  - HDF5 High-Level library: ENABLED (required for NetCDF)"
log "  - Dynamically loaded filter plugins: NOT SUPPORTED (static build)"
log ""
log "Important notes: https://docs.unidata.ucar.edu/netcdf-c/$NETCDF_VERSION/filters.html"
# Create a simple C wrapper that exposes NetCDF functions
cat > netcdf_wrapper.c << 'EOF'
#include <netcdf.h>
#include <hdf5.h>
#include <emscripten.h>

// =========================
// Compression Filters
// =========================
// Defined in libh5filters.a, built from NetCDF's filter plugins
extern const H5Z_class2_t blosc_H5Filter[1];
extern const H5Z_class2_t H5Z_ZSTD[1];
extern const H5Z_class2_t H5Z_BZIP2[1];

// HDF5 would look for these filters as plugins to load at runtime, which
// WebAssembly can't do, so register the statically linked ones on startup
__attribute__((constructor))
static void register_filters(void) {
    H5Zregister(blosc_H5Filter);
    H5Zregister(H5Z_ZSTD);
    H5Zregister(H5Z_BZIP2);
}

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
// Groups
// =========================
EMSCRIPTEN_KEEPALIVE
int nc_inq_grps_wrapper(int ncid, int* numgrps, int* grpids) {
    return nc_inq_grps(ncid, numgrps, grpids);
}

EMSCRIPTEN_KEEPALIVE
int nc_inq_grp_ncid_wrapper(int ncid, const char* grp_name, int* grp_ncid) {
    return nc_inq_grp_ncid(ncid, grp_name, grp_ncid);
}

EMSCRIPTEN_KEEPALIVE
int nc_inq_grpname_wrapper(int ncid, char* name) {
    return nc_inq_grpname(ncid, name);
}

EMSCRIPTEN_KEEPALIVE
int nc_inq_grp_parent_wrapper(int ncid, int* parent_ncid) {
    return nc_inq_grp_parent(ncid, parent_ncid);
}

EMSCRIPTEN_KEEPALIVE
int nc_inq_grp_full_ncid_wrapper(int ncid, const char* full_name, int* grp_ncid) {
    return nc_inq_grp_full_ncid(ncid, full_name, grp_ncid);
}

EMSCRIPTEN_KEEPALIVE
int nc_inq_grpname_full_wrapper(int ncid, size_t* lenp, char* full_name) {
    return nc_inq_grpname_full(ncid, lenp, full_name);
}

EMSCRIPTEN_KEEPALIVE
int nc_inq_grpname_len_wrapper(int ncid, size_t* lenp) {
    return nc_inq_grpname_len(ncid, lenp);
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

// Fixed text
EMSCRIPTEN_KEEPALIVE
int nc_get_att_text_wrapper(int ncid, int varid, const char* name, char* value) {
    return nc_get_att_text(ncid, varid, name, value);
}

// 8-bit unsigned
EMSCRIPTEN_KEEPALIVE
int nc_get_att_uchar_wrapper(int ncid, int varid, const char* name, unsigned char* value) {
    return nc_get_att_uchar(ncid, varid, name, value);
}

// 8-bit signed
EMSCRIPTEN_KEEPALIVE
int nc_get_att_schar_wrapper(int ncid, int varid, const char* name, signed char* value) {
    return nc_get_att_schar(ncid, varid, name, value);
}

// 16-bit signed
EMSCRIPTEN_KEEPALIVE
int nc_get_att_short_wrapper(int ncid, int varid, const char* name, short* value) {
    return nc_get_att_short(ncid, varid, name, value);
}

// 32-bit signed
EMSCRIPTEN_KEEPALIVE
int nc_get_att_int_wrapper(int ncid, int varid, const char* name, int* value) {
    return nc_get_att_int(ncid, varid, name, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_att_long_wrapper(int ncid, int varid, const char* name, long* value) {
    return nc_get_att_long(ncid, varid, name, value);
}

// 32-bit float
EMSCRIPTEN_KEEPALIVE
int nc_get_att_float_wrapper(int ncid, int varid, const char* name, float* value) {
    return nc_get_att_float(ncid, varid, name, value);
}

// 64-bit float
EMSCRIPTEN_KEEPALIVE
int nc_get_att_double_wrapper(int ncid, int varid, const char* name, double* value) {
    return nc_get_att_double(ncid, varid, name, value);
}

// 16-bit unsigned
EMSCRIPTEN_KEEPALIVE
int nc_get_att_ushort_wrapper(int ncid, int varid, const char* name, unsigned short* value) {
    return nc_get_att_ushort(ncid, varid, name, value);
}

// 32-bit unsigned
EMSCRIPTEN_KEEPALIVE
int nc_get_att_uint_wrapper(int ncid, int varid, const char* name, unsigned int* value) {
    return nc_get_att_uint(ncid, varid, name, value);
}

// 64-bit signed
EMSCRIPTEN_KEEPALIVE
int nc_get_att_longlong_wrapper(int ncid, int varid, const char* name, long long* value) {
    return nc_get_att_longlong(ncid, varid, name, value);
}

// 64-bit unsigned
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

// Variable-length strings
EMSCRIPTEN_KEEPALIVE
int nc_get_att_string_wrapper(int ncid, int varid, const char* name, char** value) {
    return nc_get_att_string(ncid, varid, name, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_free_string_wrapper(size_t len, char** value) {
    nc_free_string(len, value);
    free(value);
    return 0;
}

// =========================
// Data Access (Reading)
// =========================
EMSCRIPTEN_KEEPALIVE
int nc_get_vara_text_wrapper(int ncid, int varid, const size_t* start, const size_t* count, char* value) {
    return nc_get_vara_text(ncid, varid, start, count, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_vara_string_wrapper(int ncid, int varid, const size_t* start, const size_t* count, char** value) {
    return nc_get_vara_string(ncid, varid, start, count, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_put_vara_string_wrapper(int ncid, int varid, const size_t* start, const size_t* count, const char** value) {
    return nc_put_vara_string(ncid, varid, start, count, value);
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
int nc_get_var_string_wrapper(int ncid, int varid, char** value) {
    return nc_get_var_string(ncid, varid, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_put_var_string_wrapper(int ncid, int varid, const char** value) {
    return nc_put_var_string(ncid, varid, value);
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

// Strided Data Access (nc_get_vars_*)

EMSCRIPTEN_KEEPALIVE
int nc_get_vars_schar_wrapper(int ncid, int varid, const size_t* start, const size_t* count, const ptrdiff_t* stride, signed char* value) {
    return nc_get_vars_schar(ncid, varid, start, count, stride, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_vars_uchar_wrapper(int ncid, int varid, const size_t* start, const size_t* count, const ptrdiff_t* stride, unsigned char* value) {
    return nc_get_vars_uchar(ncid, varid, start, count, stride, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_vars_short_wrapper(int ncid, int varid, const size_t* start, const size_t* count, const ptrdiff_t* stride, short* value) {
    return nc_get_vars_short(ncid, varid, start, count, stride, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_vars_ushort_wrapper(int ncid, int varid, const size_t* start, const size_t* count, const ptrdiff_t* stride, unsigned short* value) {
    return nc_get_vars_ushort(ncid, varid, start, count, stride, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_vars_int_wrapper(int ncid, int varid, const size_t* start, const size_t* count, const ptrdiff_t* stride, int* value) {
    return nc_get_vars_int(ncid, varid, start, count, stride, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_vars_uint_wrapper(int ncid, int varid, const size_t* start, const size_t* count, const ptrdiff_t* stride, unsigned int* value) {
    return nc_get_vars_uint(ncid, varid, start, count, stride, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_vars_float_wrapper(int ncid, int varid, const size_t* start, const size_t* count, const ptrdiff_t* stride, float* value) {
    return nc_get_vars_float(ncid, varid, start, count, stride, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_vars_double_wrapper(int ncid, int varid, const size_t* start, const size_t* count, const ptrdiff_t* stride, double* value) {
    return nc_get_vars_double(ncid, varid, start, count, stride, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_vars_longlong_wrapper(int ncid, int varid, const size_t* start, const size_t* count, const ptrdiff_t* stride, long long* value) {
    return nc_get_vars_longlong(ncid, varid, start, count, stride, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_vars_ulonglong_wrapper(int ncid, int varid, const size_t* start, const size_t* count, const ptrdiff_t* stride, unsigned long long* value) {
    return nc_get_vars_ulonglong(ncid, varid, start, count, stride, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_vars_string_wrapper(int ncid, int varid, const size_t* start, const size_t* count, const ptrdiff_t* stride, char** value) {
    return nc_get_vars_string(ncid, varid, start, count, stride, value);
}

// Generic strided wrapper — mirrors nc_get_vara_wrapper.
// nc_get_vars (no type suffix) reads raw bytes into void* without type checking,
// so it works for enum variables (declared type >= 32) unlike nc_get_vars_schar etc.
EMSCRIPTEN_KEEPALIVE
int nc_get_vars_wrapper(int ncid, int varid, const size_t* start, const size_t* count, const ptrdiff_t* stride, void* value) {
    return nc_get_vars(ncid, varid, start, count, stride, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_vars_text_wrapper(int ncid, int varid, const size_t* start, const size_t* count, const ptrdiff_t* stride, char* value) {
    return nc_get_vars_text(ncid, varid, start, count, stride, value);
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

// =========================
// User-defined Types (Enums)
// =========================

EMSCRIPTEN_KEEPALIVE
int nc_inq_typeids_wrapper(int ncid, int* ntypes, int* typeids) {
    return nc_inq_typeids(ncid, ntypes, typeids);
}

EMSCRIPTEN_KEEPALIVE
int nc_inq_type_wrapper(int ncid, nc_type xtype, char* name, size_t* sizep) {
    return nc_inq_type(ncid, xtype, name, sizep);
}

EMSCRIPTEN_KEEPALIVE
int nc_inq_user_type_wrapper(int ncid, nc_type xtype, char* name, size_t* sizep, nc_type* base_nc_typep, size_t* nfieldsp, int* classp) {
    return nc_inq_user_type(ncid, xtype, name, sizep, base_nc_typep, nfieldsp, classp);
}

EMSCRIPTEN_KEEPALIVE
int nc_def_enum_wrapper(int ncid, nc_type base_typeid, const char* name, nc_type* typeidp) {
    return nc_def_enum(ncid, base_typeid, name, typeidp);
}

EMSCRIPTEN_KEEPALIVE
int nc_insert_enum_wrapper(int ncid, nc_type xtype, const char* name, const void* value) {
    return nc_insert_enum(ncid, xtype, name, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_inq_enum_wrapper(int ncid, nc_type xtype, char* name, nc_type* base_nc_typep, size_t* base_sizep, size_t* num_membersp) {
    return nc_inq_enum(ncid, xtype, name, base_nc_typep, base_sizep, num_membersp);
}

EMSCRIPTEN_KEEPALIVE
int nc_inq_enum_member_wrapper(int ncid, nc_type xtype, int idx, char* name, void* value) {
    return nc_inq_enum_member(ncid, xtype, idx, name, value);
}

EMSCRIPTEN_KEEPALIVE
int nc_inq_enum_ident_wrapper(int ncid, nc_type xtype, long long value, char* identifier) {
    return nc_inq_enum_ident(ncid, xtype, value, identifier);
}

// generic untyped reader

EMSCRIPTEN_KEEPALIVE
int nc_get_var_wrapper(int ncid, int varid, void* ip) {
    return nc_get_var(ncid, varid, ip);
}

EMSCRIPTEN_KEEPALIVE
int nc_get_vara_wrapper(int ncid, int varid, const size_t* start, const size_t* count, void* ip) {
    return nc_get_vara(ncid, varid, start, count, ip);
}

EOF

# Compile to WASM
log "Creating C wrapper for NetCDF functions..."

log "Compiling WASM module with emcc..."

check_command emcc netcdf_wrapper.c \
    -I"$INSTALL_DIR/include" \
    -L"$INSTALL_DIR/lib" \
    -lnetcdf -lh5filters -lhdf5 -lhdf5_hl -lblosc -lzstd -lz \
    -lworkerfs.js \
    -s WASM=1 \
    -s MODULARIZE=1 \
    -s EXPORT_ES6=1 \
    -s ENVIRONMENT=web,worker \
    -s EXPORT_NAME="NetCDF4Module" \
    -s FORCE_FILESYSTEM=1 \
    -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","getValue","setValue","UTF8ToString","stringToUTF8","lengthBytesUTF8","FS","WORKERFS","cwrap","ccall","HEAP8","HEAP16","HEAP32","HEAPF32","HEAPF64","HEAP64","HEAPU8","HEAPU16","HEAPU32", "HEAPU64"]' \
    -s EXPORTED_FUNCTIONS='["_malloc","_free"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=16777216 \
    --pre-js "$PROJECT_ROOT/bindings/pre.js" \
    --post-js "$PROJECT_ROOT/bindings/post.js" \
    -O2 \
    -o "$DIST_DIR/netcdf4-wasm.js"

log "WASM module created successfully!"

# Verify build outputs
if [ -f "$DIST_DIR/netcdf4-wasm.js" ] && [ -f "$DIST_DIR/netcdf4-wasm.wasm" ]; then
    log "Build verification successful!"
    log "Built files:"
    log "  - $DIST_DIR/netcdf4-wasm.js ($(du -h "$DIST_DIR/netcdf4-wasm.js" | cut -f1))"
    log "  - $DIST_DIR/netcdf4-wasm.wasm ($(du -h "$DIST_DIR/netcdf4-wasm.wasm" | cut -f1))"
else
    error_exit "WASM build files not found after compilation"
fi

log "🎉 NetCDF4 WASM build completed successfully!"
log "You can now use the TypeScript interface to interact with NetCDF files."