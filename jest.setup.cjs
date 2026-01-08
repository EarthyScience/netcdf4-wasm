// Jest setup file for NetCDF4 WASM tests

// Mock the global NetCDF4Module function if not available
if (typeof global.NetCDF4Module === 'undefined') {
  global.NetCDF4Module = jest.fn().mockRejectedValue(
    new Error('NetCDF4Module not available in test environment')
  );
}

// Mock Node.js modules for WASM module
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/'))
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(() => false),
  mkdirSync: jest.fn(),
  unlinkSync: jest.fn(),
  rmdirSync: jest.fn(),
  readdirSync: jest.fn(() => [])
}));

// Console warnings for missing WASM module are expected in tests
const originalWarn = console.warn;
console.warn = (...args) => {
  if (args[0] && args[0].includes('WASM module not available')) {
    // Suppress expected warnings in tests
    return;
  }
  if (args[0] && args[0].includes('sync() not yet implemented')) {
    // Suppress expected warnings about unimplemented features
    return;
  }
  originalWarn.apply(console, args);
};

// Set longer timeout for integration tests
jest.setTimeout(30000);