// Dimension tests following netcdf4-python patterns

import { Dataset, NetCDF4, Dimension, NC_CONSTANTS } from '../index.js';
import { TestSetup } from '../test-setup.js';
import { mockMode } from '../test-setup.js';

describe('Dimension Tests', () => {
    beforeAll(() => {
        TestSetup.setupTestEnvironment();
        // mockMode = TestSetup.mockWasmModule();
    });

    afterAll(() => {
        TestSetup.cleanupTestEnvironment();
    });

    describe('Dimension Creation', () => {
        test('should create fixed-size dimensions', async () => {
            const filename = TestSetup.getTestFilename('_dims_fixed');
            
            if (mockMode) {
                const nc = new NetCDF4(filename, 'w');
                // Test the interface even without WASM
                expect(Object.keys(nc.dimensions)).toHaveLength(0);
                return;
            }

            try {
                const nc = await Dataset(filename, 'w');
                
                // Create fixed dimensions
                const lat = await nc.createDimension('lat', 73);
                const lon = await nc.createDimension('lon', 144);
                
                expect(lat).toBeInstanceOf(Dimension);
                expect(lat.name).toBe('lat');
                expect(lat.size).toBe(73);
                expect(lat.isUnlimited).toBe(false);
                
                expect(lon).toBeInstanceOf(Dimension);
                expect(lon.name).toBe('lon');
                expect(lon.size).toBe(144);
                expect(lon.isUnlimited).toBe(false);
                
                // Check dimensions are stored in dataset
                expect(Object.keys(nc.dimensions)).toContain('lat');
                expect(Object.keys(nc.dimensions)).toContain('lon');
                expect(nc.dimensions.lat).toBe(lat);
                expect(nc.dimensions.lon).toBe(lon);
                
                await nc.close();
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });

        test('should create unlimited dimensions', async () => {
            const filename = TestSetup.getTestFilename('_dims_unlimited');
            
            if (mockMode) {
                // Test interface without WASM
                const nc = new NetCDF4(filename, 'w');
                return;
            }

            try {
                const nc = await Dataset(filename, 'w');
                
                // Create unlimited dimension using null
                const time = await nc.createDimension('time', null);
                
                expect(time).toBeInstanceOf(Dimension);
                expect(time.name).toBe('time');
                expect(time.size).toBe(NC_CONSTANTS.NC_UNLIMITED);
                expect(time.isUnlimited).toBe(true);
                
                // Create unlimited dimension using NC_UNLIMITED constant
                const record = await nc.createDimension('record', NC_CONSTANTS.NC_UNLIMITED);
                
                expect(record.isUnlimited).toBe(true);
                expect(record.size).toBe(NC_CONSTANTS.NC_UNLIMITED);
                
                await nc.close();
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });

        test('should handle dimension name validation', async () => {
            const filename = TestSetup.getTestFilename('_dims_validation');
            
            if (mockMode) {
                pending('WASM module not available');
                return;
            }

            try {
                const nc = await Dataset(filename, 'w');
                
                // Valid dimension names
                await nc.createDimension('lat', 10);
                await nc.createDimension('longitude', 20);
                await nc.createDimension('time_step', 30);
                await nc.createDimension('level_1', 5);
                
                expect(Object.keys(nc.dimensions)).toHaveLength(4);
                
                // Test duplicate dimension name should throw error
                expect(async () => {
                    await nc.createDimension('lat', 15);
                }).rejects.toThrow();
                
                await nc.close();
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });
    });

    describe('Dimension Properties', () => {
        test('should provide correct dimension properties', async () => {
            const filename = TestSetup.getTestFilename('_dims_props');
            
            if (mockMode) {
                const dim = new Dimension('test', 100, false);
                expect(dim.name).toBe('test');
                expect(dim.size).toBe(100);
                expect(dim.isUnlimited).toBe(false);
                expect(dim.__len__()).toBe(100);
                return;
            }

            try {
                const nc = await Dataset(filename, 'w');
                
                const fixed_dim = await nc.createDimension('fixed', 50);
                const unlimited_dim = await nc.createDimension('unlimited', null);
                
                // Test fixed dimension properties
                expect(fixed_dim.name).toBe('fixed');
                expect(fixed_dim.size).toBe(50);
                expect(fixed_dim.isUnlimited).toBe(false);
                expect(fixed_dim.__len__()).toBe(50);
                
                // Test unlimited dimension properties
                expect(unlimited_dim.name).toBe('unlimited');
                expect(unlimited_dim.isUnlimited).toBe(true);
                expect(unlimited_dim.__len__()).toBe(NC_CONSTANTS.NC_UNLIMITED);
                
                await nc.close();
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });

        test('should have string representation', () => {
            const fixed_dim = new Dimension('lat', 73, false);
            const unlimited_dim = new Dimension('time', NC_CONSTANTS.NC_UNLIMITED, true);
            
            expect(fixed_dim.toString()).toContain('lat');
            expect(fixed_dim.toString()).toContain('73');
            
            expect(unlimited_dim.toString()).toContain('time');
            expect(unlimited_dim.toString()).toContain('unlimited');
        });
    });

    describe('Dimension Collections', () => {
        test('should manage dimension collections correctly', async () => {
            const filename = TestSetup.getTestFilename('_dims_collections');
            
            if (mockMode) {
                const nc = new NetCDF4(filename, 'w');
                expect(Object.keys(nc.dimensions)).toHaveLength(0);
                return;
            }

            try {
                const nc = await Dataset(filename, 'w');
                
                // Initially empty
                expect(Object.keys(nc.dimensions)).toHaveLength(0);
                
                // Add dimensions
                await nc.createDimension('x', 10);
                await nc.createDimension('y', 20);
                await nc.createDimension('z', 30);
                await nc.createDimension('time', null);
                
                // Check collection contents
                const dimNames = Object.keys(nc.dimensions);
                expect(dimNames).toHaveLength(4);
                expect(dimNames).toContain('x');
                expect(dimNames).toContain('y');
                expect(dimNames).toContain('z');
                expect(dimNames).toContain('time');
                
                // Check dimension access
                expect(nc.dimensions.x.size).toBe(10);
                expect(nc.dimensions.y.size).toBe(20);
                expect(nc.dimensions.z.size).toBe(30);
                expect(nc.dimensions.time.isUnlimited).toBe(true);
                
                await nc.close();
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });

        test('should handle dimension iteration patterns', async () => {
            const filename = TestSetup.getTestFilename('_dims_iteration');
            
            if (mockMode) {
                pending('WASM module not available');
                return;
            }

            try {
                const nc = await Dataset(filename, 'w');
                
                const expected_dims = {
                    'lat': 73,
                    'lon': 144,
                    'level': 17,
                    'time': null
                };
                
                // Create dimensions
                for (const [name, size] of Object.entries(expected_dims)) {
                    await nc.createDimension(name, size);
                }
                
                // Test iteration over dimensions
                const actual_dims: { [key: string]: number | null } = {};
                for (const [name, dim] of Object.entries(nc.dimensions)) {
                    actual_dims[name] = dim.isUnlimited ? null : dim.size;
                }
                
                expect(actual_dims).toEqual(expected_dims);
                
                await nc.close();
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });
    });

    describe('Dimension Edge Cases', () => {
        test('should handle zero-sized dimensions', async () => {
            const filename = TestSetup.getTestFilename('_dims_zero');
            
            if (mockMode) {
                pending('WASM module not available');
                return;
            }

            try {
                const nc = await Dataset(filename, 'w');
                
                const empty_dim = await nc.createDimension('empty', 0);
                expect(empty_dim.size).toBe(0);
                expect(empty_dim.isUnlimited).toBe(false);
                expect(empty_dim.__len__()).toBe(0);
                
                await nc.close();
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });

        test('should handle large dimensions', async () => {
            const filename = TestSetup.getTestFilename('_dims_large');
            
            if (mockMode) {
                const dim = new Dimension('large', 1000000, false);
                expect(dim.size).toBe(1000000);
                return;
            }

            try {
                const nc = await Dataset(filename, 'w');
                
                const large_dim = await nc.createDimension('large', 1000000);
                expect(large_dim.size).toBe(1000000);
                expect(large_dim.isUnlimited).toBe(false);
                
                await nc.close();
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });

        test('should validate dimension size constraints', async () => {
            const filename = TestSetup.getTestFilename('_dims_constraints');
            
            if (mockMode) {
                pending('WASM module not available');
                return;
            }

            try {
                const nc = await Dataset(filename, 'w');
                
                // Negative size should be rejected
                expect(async () => {
                    await nc.createDimension('negative', -1);
                }).rejects.toThrow();
                
                await nc.close();
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });
    });

    describe('Dimension Groups', () => {
        test('should handle dimensions in groups', async () => {
            const filename = TestSetup.getTestFilename('_dims_groups');
            
            if (mockMode) {
                const nc = new NetCDF4(filename, 'w');
                const group = nc.createGroup('data');
                expect(Object.keys(group.dimensions)).toHaveLength(0);
                return;
            }

            try {
                const nc = await Dataset(filename, 'w');
                
                // Create dimensions in root
                await nc.createDimension('global_time', null);
                await nc.createDimension('global_level', 10);
                
                // Create group and dimensions in group
                const data_group = nc.createGroup('data');
                await data_group.createDimension('local_x', 100);
                await data_group.createDimension('local_y', 200);
                
                // Check root dimensions
                expect(Object.keys(nc.dimensions)).toHaveLength(2);
                expect(nc.dimensions.global_time.isUnlimited).toBe(true);
                expect(nc.dimensions.global_level.size).toBe(10);
                
                // Check group dimensions
                expect(Object.keys(data_group.dimensions)).toHaveLength(2);
                expect(data_group.dimensions.local_x.size).toBe(100);
                expect(data_group.dimensions.local_y.size).toBe(200);
                
                await nc.close();
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });
    });
});