// Pre-run JavaScript for NetCDF4 WASM module
// This file is executed before the WASM module is initialized

// Configure module settings (Module will be provided by Emscripten)
Module.preRun = Module.preRun || [];
Module.postRun = Module.postRun || [];

// Memory and filesystem setup
Module.preRun.push(function() {
    console.log('NetCDF4 WASM: Initializing...');
});

Module.postRun.push(function() {
    console.log('NetCDF4 WASM: Ready');
});

// Note: When using EXPORT_ES6=1, Emscripten handles the module export
// No need to manually export - the factory function is exported by default