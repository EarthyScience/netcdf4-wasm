#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
EMSDK_DIR="$PROJECT_ROOT/build/emsdk"

echo "Installing Emscripten SDK..."

# Create build directory
mkdir -p "$PROJECT_ROOT/build"
cd "$PROJECT_ROOT/build"

# Clone emsdk if not already present
if [ ! -d "emsdk" ]; then
    echo "Cloning Emscripten SDK..."
    git clone https://github.com/emscripten-core/emsdk.git
fi

cd emsdk

# Update emsdk
echo "Updating Emscripten SDK..."
git pull || true

# Install and activate 4.0.23 version
EMSDK_VERSION=4.0.23
echo "Installing 4.0.23 Emscripten..."
./emsdk install $EMSDK_VERSION

echo "Activating 4.0.23 Emscripten..."
./emsdk activate $EMSDK_VERSION

# Source the environment
echo "Sourcing emsdk environment..."
source ./emsdk_env.sh

echo ""
echo ""
echo "✅ Emscripten SDK $EMSDK_VERSION installed successfully!"
echo ""
echo "To use Emscripten in your shell, run:"
echo "source $EMSDK_DIR/emsdk_env.sh"
echo ""
echo "Or add this to your build script:"
echo "source \"\$(dirname \"\$0\")/../build/emsdk/emsdk_env.sh\""