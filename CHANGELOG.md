# Changelog

## [0.2.0] - 2026-02-15
- Added support for NetCDF groups, enabling hierarchical data organization.
- Introduced the DataTree class to explore the complete dataset structure.
- Updated the documentation UI with group browsing and variable search capabilities. [#37](https://github.com/EarthyScience/netcdf4-wasm/pull/37)

## [0.1.3] - 2026-01-11

- Fully automated build process.
-  `package-lock.json` was removed because trying to develop this locally will fail otherwise, (same reason in CI)
- in macOS is necessary to be explicit with `emmake make -j1 AR=emar ARFLAGS=rcs RANLIB=emranlib`
- in newer versions `_malloc` and `_free` need to be exported functions and not runtime methods.
   -  `post.js` was updated accordingly. 
- `sed -i ''` is required in macOS, hence a check was added to account for that.
- Use Perl for cross-platform multi-line insertion, `perl -i -pe ...`
- a lot of new functionality by adding new functions. 
   -  additional built flags were added. 
- more types 
- CI via GitHub Actions, making sure the full workflow from building to tests works.
-  removed the `global` **Module** definition. Now things should work with the standard `import` statement.
   - tests were updated accordingly. 
- `netcdf-workers.ts` implementation was added so that lazy reading works!
- Online demo showing functionality. 
- Legacy examples and docs were removed, content should be added back once is properly tested.

# Legacy from init project

## [0.1.0] - 2024-12-17

### Added
- Initial implementation of NetCDF4 WASM bindings
- Python netcdf4-python compatible API
- Complete TypeScript interface with proper typing
- Modular code structure for maintainability

### Features
- NetCDF4 C library compilation to WASM via Emscripten
- Support for HDF5 and zlib dependencies
- Python-like Dataset, Variable, Dimension, and Group classes
- Comprehensive build system with dependency checking
- Jest test suite foundation
- NPM packaging configuration

### API Structure
- `src/index.ts` - Main exports and convenience functions
- `src/netcdf4.ts` - Main NetCDF4 class (equivalent to Python's Dataset)
- `src/variable.ts` - Variable class with attribute support
- `src/dimension.ts` - Dimension class
- `src/group.ts` - Hierarchical group support
- `src/constants.ts` - NetCDF constants and type mappings
- `src/types.ts` - TypeScript type definitions
- `src/wasm-module.ts` - WASM module loading and wrapping

### Build System
- Automated dependency building (zlib, HDF5, NetCDF4)
- Emscripten toolchain integration
- Cross-platform build scripts
- Development dependency checking

### Documentation
- Comprehensive README with Python-like examples
- API reference documentation
- Build and development instructions
- Project structure documentation