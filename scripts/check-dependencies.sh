#!/bin/bash
set -e

echo "Checking build dependencies for NetCDF4 WASM..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
EMSDK_ENV="$PROJECT_ROOT/build/emsdk/emsdk_env.sh"

# Source Emscripten environment if it exists
if [ -f "$EMSDK_ENV" ]; then
    echo "Loading Emscripten environment..."
    source "$EMSDK_ENV"
fi

# Check for required tools
MISSING_DEPS=()

# Check for Emscripten
if ! command -v emcc &> /dev/null; then
    MISSING_DEPS+=("emscripten")
    echo "❌ Emscripten not found"
else
    echo "✅ Emscripten found: $(emcc --version | head -n1)"
fi

# Check for wget/curl for downloading sources
if ! command -v wget &> /dev/null && ! command -v curl &> /dev/null; then
    MISSING_DEPS+=("wget or curl")
    echo "❌ Neither wget nor curl found"
else
    echo "✅ Download tool available"
fi

# Check for tar
if ! command -v tar &> /dev/null; then
    MISSING_DEPS+=("tar")
    echo "❌ tar not found"
else
    echo "✅ tar found"
fi

# Check for make
if ! command -v make &> /dev/null; then
    MISSING_DEPS+=("make")
    echo "❌ make not found"
else
    echo "✅ make found"
fi

# Check for cmake
if ! command -v cmake &> /dev/null; then
    MISSING_DEPS+=("cmake")
    echo "❌ cmake not found"
else
    echo "✅ cmake found"
fi

if [ ${#MISSING_DEPS[@]} -eq 0 ]; then
    echo "✅ All dependencies are available!"
    exit 0
else
    echo ""
    echo "❌ Missing dependencies: ${MISSING_DEPS[*]}"
    echo ""
    echo "To install missing dependencies:"
    echo "- Emscripten: Run 'npm run install-emscripten' or visit https://emscripten.org/docs/getting_started/downloads.html"
    echo "- On Ubuntu/Debian: sudo apt install wget tar make cmake"
    echo "- On macOS: brew install wget tar make cmake"
    exit 1
fi