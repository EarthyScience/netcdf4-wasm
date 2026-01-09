# netcdf4-wasm

Partial compilation of NetCDF4 library to WebAssembly with TypeScript bindings.

## Overview

This project provides a partial WebAssembly port of the NetCDF4 C library, enabling NetCDF file operations in browser and Node.js environments. It includes:

- A partial NetCDF4 C library compiled to WASM using Emscripten
- High-level TypeScript/JavaScript API
- Support for reading and writing NetCDF4 files

## Installation

```bash
npm install @earthyscience/netcdf4-wasm
```

## Prerequisites

For building from source, you'll need:

- Emscripten SDK
- CMake
- Make
- wget or curl

Check dependencies:

```bash
npm run check-deps
```

Install Emscripten locally:

```bash
npm run install-emscripten
```

## Usage

The JavaScript API is modeled closely on the [netcdf4-python](https://unidata.github.io/netcdf4-python) API.

### Basic Example

- WIP

### Reading Files

- WIP

### Alternative Constructor (Direct Instantiation)

- WIP

### Working with Groups

- WIP

## API Reference

The API closely follows netcdf4-python conventions for ease of use by scientists familiar with Python.


## Building

### Install dependencies

```bash
npm install
```

### Check build dependencies

```bash
npm run check-deps
```

### Build the project

```bash
npm run build
```

This will:

1. Download and compile zlib, HDF5, and NetCDF4 C libraries
2. Create the WASM module with Emscripten
3. Compile TypeScript bindings

### Clean build artifacts

```bash
npm run clean
```

## Testing

Run tests:

```bash
npm test
```

Run tests with coverage:

```bash
npm run test:coverage
```

Watch mode:

```bash
npm run test:watch
```

## Development

### Project Structure

```
netcdf4-wasm/
├── src/                    # TypeScript source code
│   ├── index.ts           # Main API exports
│   ├── types.ts           # Type definitions
│   ├── constants.ts       # NetCDF constants
│   ├── netcdf4.ts         # Main NetCDF4 class
│   ├── netcdf-workers.ts
│   ├── netcdf-getters.ts
│   ├── group.ts           # Group class
│   ├── variable.ts        # Variable class
│   ├── dimension.ts       # Dimension class
│   ├── wasm-module.ts     # WASM module loader
│   └── __tests__/         # Test files
├── scripts/               # Build scripts
│   ├── build-wasm.sh     # Main WASM build script
│   ├── check-dependencies.sh
│   └── install-emscripten.sh
├── bindings/              # WASM bindings
│   ├── pre.js            # Pre-run JavaScript
│   └── post.js           # Post-run JavaScript
├── build/                 # Build artifacts (generated)
├── dist/                  # Distribution files (generated)
└── package.json
```


## NetCDF4 Documentation

For more information about NetCDF4, visit: https://docs.unidata.ucar.edu/netcdf-c/current/

## Troubleshooting

### WASM Module Not Found

Make sure the WASM files are properly built and accessible:

```bash
npm run build:wasm
```

### Emscripten Not Found

Install Emscripten:

```bash
npm run install-emscripten
source build/emsdk/emsdk_env.sh
```

### Memory Issues

If you encounter memory-related errors, try increasing the initial memory:

```typescript
const netcdf = new NetCDF4({ memoryInitialPages: 512 });
```
