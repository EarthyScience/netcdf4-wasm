// Dataset creation and basic I/O tests following netcdf4-python patterns

import { Dataset, NetCDF4, NC_CONSTANTS } from '../index.js';
import { TestSetup } from '../test-setup.js';
import { mockMode } from '../test-setup.js';

describe('Dataset Creation and Basic I/O', () => {
    // let mockMode = false;

    beforeAll(() => {
        TestSetup.setupTestEnvironment();
        // mockMode = TestSetup.mockWasmModule();
    });

    afterAll(() => {
        TestSetup.cleanupTestEnvironment();
    });

    describe('Dataset Construction', () => {
        test('should create Dataset using factory method', async () => {
            const filename = TestSetup.getTestFilename('_factory');
            
            if (mockMode) {
                // In mock mode, Dataset creation should work
                const nc = await Dataset(filename, 'w', { format: 'NETCDF4' });
                expect(nc).toBeInstanceOf(NetCDF4);
                await nc.close();
                return;
            }

            try {
                const nc = await Dataset(filename, 'w', { format: 'NETCDF4' });
                expect(nc).toBeInstanceOf(NetCDF4);
                expect(nc.filepath).toBe(filename);
                expect(nc.file_format).toBe('NETCDF4');
                expect(nc.isopen).toBe(true);
                await nc.close();
                expect(nc.isopen).toBe(false);
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });

        test('should create Dataset using class method', async () => {
            const filename = TestSetup.getTestFilename('_class');
            
            if (mockMode) {
                // In mock mode, Dataset creation should work
                const nc = await NetCDF4.Dataset(filename, 'w');
                expect(nc).toBeInstanceOf(NetCDF4);
                await nc.close();
                return;
            }

            try {
                const nc = await NetCDF4.Dataset(filename, 'w');
                expect(nc).toBeInstanceOf(NetCDF4);
                expect(nc.filepath).toBe(filename);
                await nc.close();
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });

        test('should create Dataset using constructor', async () => {
            const filename = TestSetup.getTestFilename('_constructor');
            
            if (mockMode) {
                // In mock mode, initialization should work
                const nc = new NetCDF4(filename, 'w', { format: 'NETCDF4' });
                expect(nc).toBeInstanceOf(NetCDF4);
                await nc.initialize();
                expect(nc.isInitialized()).toBe(true);
                await nc.close();
                return;
            }

            try {
                const nc = new NetCDF4(filename, 'w', { format: 'NETCDF4' });
                await nc.initialize();
                expect(nc.isInitialized()).toBe(true);
                expect(nc.isopen).toBe(true);
                await nc.close();
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });
    });

    describe('File Modes', () => {
        test('should handle write mode', async () => {
            const filename = TestSetup.getTestFilename('_write');
            
            if (mockMode) {
                pending('WASM module not available');
                return;
            }

            try {
                const nc = await Dataset(filename, 'w');
                expect(nc.isopen).toBe(true);
                await nc.close();
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });

        test('should handle read mode for existing file', async () => {
            const filename = TestSetup.getTestFilename('_read');
            
            if (mockMode) {
                pending('WASM module not available');
                return;
            }

            try {
                // First create a file
                const nc_write = await Dataset(filename, 'w');
                await nc_write.close();

                // Then read it
                const nc_read = await Dataset(filename, 'r');
                expect(nc_read.isopen).toBe(true);
                await nc_read.close();
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });

        test('should handle append mode', async () => {
            const filename = TestSetup.getTestFilename('_append');
            
            if (mockMode) {
                pending('WASM module not available');
                return;
            }

            try {
                // First create a file
                const nc_write = await Dataset(filename, 'w');
                await nc_write.close();

                // Then append to it
                const nc_append = await Dataset(filename, 'a');
                expect(nc_append.isopen).toBe(true);
                await nc_append.close();
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });
    });

    describe('File Formats', () => {
        test('should support NETCDF4 format', async () => {
            const filename = TestSetup.getTestFilename('_netcdf4');
            
            if (mockMode) {
                const nc = new NetCDF4(filename, 'w', { format: 'NETCDF4' });
                expect(nc.file_format).toBe('NETCDF4');
                return;
            }

            try {
                const nc = await Dataset(filename, 'w', { format: 'NETCDF4' });
                expect(nc.file_format).toBe('NETCDF4');
                expect(nc.disk_format).toBe('NETCDF4');
                await nc.close();
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });

        test('should default to NETCDF4 format', async () => {
            const filename = TestSetup.getTestFilename('_default');
            
            if (mockMode) {
                const nc = new NetCDF4(filename, 'w');
                expect(nc.file_format).toBe('NETCDF4');
                return;
            }

            try {
                const nc = await Dataset(filename, 'w');
                expect(nc.file_format).toBe('NETCDF4');
                await nc.close();
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });
    });

    describe('Dataset Properties', () => {
        test('should provide correct filepath', async () => {
            const filename = TestSetup.getTestFilename('_filepath');
            
            const nc = new NetCDF4(filename, 'w');
            expect(nc.filepath).toBe(filename);
            
            if (!mockMode) {
                try {
                    await nc.initialize();
                    await nc.close();
                } finally {
                    TestSetup.cleanupTestFile(filename);
                }
            }
        });

        test('should track open/closed state', async () => {
            const filename = TestSetup.getTestFilename('_state');
            
            if (mockMode) {
                const nc = new NetCDF4(filename, 'w');
                expect(nc.isopen).toBe(false);
                return;
            }

            try {
                const nc = await Dataset(filename, 'w');
                expect(nc.isopen).toBe(true);
                await nc.close();
                expect(nc.isopen).toBe(false);
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });

        test('should have empty collections initially', () => {
            const filename = TestSetup.getTestFilename('_collections');
            const nc = new NetCDF4(filename, 'w');
            
            expect(Object.keys(nc.dimensions)).toHaveLength(0);
            expect(Object.keys(nc.variables)).toHaveLength(0);
            expect(Object.keys(nc.groups)).toHaveLength(0);
        });
    });

    describe('Error Handling', () => {
        test('should throw error for invalid file mode', async () => {
            const filename = TestSetup.getTestFilename('_invalid_mode');
            
            // Both mock and real mode should reject invalid modes
            expect(async () => {
                await Dataset(filename, 'invalid' as any);
            }).rejects.toThrow('Unsupported mode');
        });

        test('should throw error when accessing uninitialized module', () => {
            const nc = new NetCDF4();
            expect(() => nc.getModule()).toThrow('NetCDF4 module not initialized');
        });

        test('should handle file operation errors gracefully', async () => {
            // Test with a clearly invalid path that should fail even in mock mode
            await expect(Dataset('', 'r')).rejects.toThrow();
        });
    });

    describe('Context Manager (Python-like)', () => {
        test('should support context manager pattern', async () => {
            const filename = TestSetup.getTestFilename('_context');
            
            if (mockMode) {
                const nc = new NetCDF4(filename, 'w');
                const entered = await nc.__aenter__();
                expect(entered).toBe(nc);
                await nc.__aexit__();
                return;
            }

            try {
                const nc = new NetCDF4(filename, 'w');
                const entered = await nc.__aenter__();
                expect(entered).toBe(nc);
                expect(nc.isopen).toBe(true);
                await nc.__aexit__();
                expect(nc.isopen).toBe(false);
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });
    });
});