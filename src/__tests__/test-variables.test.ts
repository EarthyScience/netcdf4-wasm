// Variable tests following netcdf4-python patterns

import { Dataset, NetCDF4, Variable, NC_CONSTANTS } from '../index.js';
import { TestSetup } from '../test-setup.js';
import { mockMode } from '../test-setup.js';

describe('Variable Tests', () => {
    // let mockMode = false;

    beforeAll(() => {
        TestSetup.setupTestEnvironment();
        // mockMode = TestSetup.mockWasmModule();
    });

    afterAll(() => {
        TestSetup.cleanupTestEnvironment();
    });

    describe('Variable Creation', () => {
        test('should create scalar variables', async () => {
            const filename = TestSetup.getTestFilename('_vars_scalar');
            
            if (mockMode) {
                const nc = new NetCDF4(filename, 'w');
                expect(Object.keys(nc.variables)).toHaveLength(0);
                return;
            }

            try {
                const nc = await Dataset(filename, 'w');
                
                // Create scalar variables (no dimensions)
                const temp_scalar = await nc.createVariable('temperature', 'f4', []);
                const pressure_scalar = await nc.createVariable('pressure', 'f8', []);
                
                expect(temp_scalar).toBeInstanceOf(Variable);
                expect(temp_scalar.name).toBe('temperature');
                expect(temp_scalar.datatype).toBe('f4');
                expect(temp_scalar.dimensions).toEqual([]);
                
                expect(pressure_scalar.name).toBe('pressure');
                expect(pressure_scalar.datatype).toBe('f8');
                expect(pressure_scalar.dimensions).toEqual([]);
                
                // Check variables are stored in dataset
                expect(Object.keys(nc.variables)).toContain('temperature');
                expect(Object.keys(nc.variables)).toContain('pressure');
                
                await nc.close();
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });

        test('should create multi-dimensional variables', async () => {
            const filename = TestSetup.getTestFilename('_vars_multidim');
            
            if (mockMode) {
                pending('WASM module not available');
                return;
            }

            try {
                const nc = await Dataset(filename, 'w');
                
                // Create dimensions
                await nc.createDimension('time', null);
                await nc.createDimension('lat', 73);
                await nc.createDimension('lon', 144);
                await nc.createDimension('level', 17);
                
                // Create multi-dimensional variables
                const temp = await nc.createVariable('temperature', 'f4', ['time', 'level', 'lat', 'lon']);
                const wind_u = await nc.createVariable('wind_u', 'f4', ['time', 'level', 'lat', 'lon']);
                const wind_v = await nc.createVariable('wind_v', 'f4', ['time', 'level', 'lat', 'lon']);
                
                expect(temp.dimensions).toEqual(['time', 'level', 'lat', 'lon']);
                expect(wind_u.dimensions).toEqual(['time', 'level', 'lat', 'lon']);
                expect(wind_v.dimensions).toEqual(['time', 'level', 'lat', 'lon']);
                
                // Create 2D variables
                const surface_temp = await nc.createVariable('surface_temperature', 'f8', ['time', 'lat', 'lon']);
                expect(surface_temp.dimensions).toEqual(['time', 'lat', 'lon']);
                
                // Create 1D coordinate variables
                const time_var = await nc.createVariable('time', 'f8', ['time']);
                const lat_var = await nc.createVariable('latitude', 'f4', ['lat']);
                const lon_var = await nc.createVariable('longitude', 'f4', ['lon']);
                
                expect(time_var.dimensions).toEqual(['time']);
                expect(lat_var.dimensions).toEqual(['lat']);
                expect(lon_var.dimensions).toEqual(['lon']);
                
                await nc.close();
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });

        test('should support different data types', async () => {
            const filename = TestSetup.getTestFilename('_vars_types');
            
            if (mockMode) {
                pending('WASM module not available');
                return;
            }

            try {
                const nc = await Dataset(filename, 'w');
                
                await nc.createDimension('x', 10);
                
                // Test different data types
                const data_types = {
                    'byte_var': 'i1',
                    'short_var': 'i2', 
                    'int_var': 'i4',
                    'float_var': 'f4',
                    'double_var': 'f8',
                    'char_var': 'S1'
                };
                
                for (const [name, dtype] of Object.entries(data_types)) {
                    const var_obj = await nc.createVariable(name, dtype, ['x']);
                    expect(var_obj.datatype).toBe(dtype);
                    expect(nc.variables[name]).toBe(var_obj);
                }
                
                // Test alternative type names
                const alt_double = await nc.createVariable('alt_double', 'double', ['x']);
                const alt_float = await nc.createVariable('alt_float', 'float', ['x']);
                const alt_int = await nc.createVariable('alt_int', 'int', ['x']);
                
                expect(alt_double.datatype).toBe('double');
                expect(alt_float.datatype).toBe('float');
                expect(alt_int.datatype).toBe('int');
                
                await nc.close();
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });

        test('should handle variable creation options', async () => {
            const filename = TestSetup.getTestFilename('_vars_options');
            
            if (mockMode) {
                pending('WASM module not available');
                return;
            }

            try {
                const nc = await Dataset(filename, 'w');
                
                await nc.createDimension('x', 1000);
                await nc.createDimension('y', 1000);
                
                // Create variable with compression options
                const compressed_var = await nc.createVariable('compressed_data', 'f4', ['x', 'y'], {
                    zlib: true,
                    complevel: 6,
                    shuffle: true,
                    fletcher32: true
                });
                
                expect(compressed_var.name).toBe('compressed_data');
                expect(compressed_var.datatype).toBe('f4');
                
                // Create variable with chunking
                const chunked_var = await nc.createVariable('chunked_data', 'f8', ['x', 'y'], {
                    chunksizes: [100, 100]
                });
                
                expect(chunked_var.name).toBe('chunked_data');
                
                await nc.close();
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });
    });

    describe('Variable Properties', () => {
        test('should provide correct variable metadata', async () => {
            const filename = TestSetup.getTestFilename('_vars_metadata');
            
            if (mockMode) {
                const nc = new NetCDF4(filename, 'w');
                return;
            }

            try {
                const nc = await Dataset(filename, 'w');
                
                await nc.createDimension('time', 10);
                await nc.createDimension('lat', 73);
                await nc.createDimension('lon', 144);
                
                const temp = await nc.createVariable('temperature', 'f4', ['time', 'lat', 'lon']);
                
                expect(temp.name).toBe('temperature');
                expect(temp.datatype).toBe('f4');
                expect(temp.dimensions).toEqual(['time', 'lat', 'lon']);
                
                await nc.close();
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });

        test('should have string representation', async () => {
            const filename = TestSetup.getTestFilename('_vars_str');
            
            if (mockMode) {
                const nc = new NetCDF4(filename, 'w');
                return;
            }

            try {
                const nc = await Dataset(filename, 'w');
                
                await nc.createDimension('x', 10);
                await nc.createDimension('y', 20);
                
                const var_2d = await nc.createVariable('data', 'f8', ['x', 'y']);
                const var_scalar = await nc.createVariable('scalar', 'f4', []);
                
                const str_2d = var_2d.toString();
                const str_scalar = var_scalar.toString();
                
                expect(str_2d).toContain('data');
                expect(str_2d).toContain('f8');
                expect(str_2d).toContain('x, y');
                
                expect(str_scalar).toContain('scalar');
                expect(str_scalar).toContain('f4');
                
                await nc.close();
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });
    });

    describe('Variable Data I/O', () => {
        test('should write and read variable data', async () => {
            const filename = TestSetup.getTestFilename('_vars_data_io');
            
            if (mockMode) {
                pending('WASM module not available');
                return;
            }

            try {
                const nc = await Dataset(filename, 'w');
                
                await nc.createDimension('x', 5);
                await nc.createDimension('y', 4);
                
                const data_var = await nc.createVariable('data', 'f8', ['x', 'y']);
                
                // Create test data
                const write_data = TestSetup.createTestData([5, 4]);
                
                // Write data
                await data_var.setValue(write_data);
                
                // Read data back
                const read_data = await data_var.getValue();
                
                // Compare data
                TestSetup.assertArraysAlmostEqual(read_data, write_data);
                
                await nc.close();
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });

        test('should handle scalar variable data', async () => {
            const filename = TestSetup.getTestFilename('_vars_scalar_data');
            
            if (mockMode) {
                pending('WASM module not available');
                return;
            }

            try {
                const nc = await Dataset(filename, 'w');
                
                const scalar_var = await nc.createVariable('scalar', 'f8', []);
                
                // Write scalar data
                const scalar_data = new Float64Array([42.5]);
                await scalar_var.setValue(scalar_data);
                
                // Read scalar data
                const read_data = await scalar_var.getValue();
                expect(read_data.length).toBe(1);
                expect(read_data[0]).toBeCloseTo(42.5);
                
                await nc.close();
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });

        test('should handle different data patterns', async () => {
            const filename = TestSetup.getTestFilename('_vars_patterns');
            
            if (mockMode) {
                pending('WASM module not available');
                return;
            }

            try {
                const nc = await Dataset(filename, 'w');
                
                await nc.createDimension('lat', 10);
                await nc.createDimension('lon', 20);
                
                const temp_var = await nc.createVariable('temperature', 'f8', ['lat', 'lon']);
                
                // Create temperature-like data
                const temp_data = TestSetup.createTemperatureData(10, 20);
                
                await temp_var.setValue(temp_data);
                const read_temp = await temp_var.getValue();
                
                TestSetup.assertArraysAlmostEqual(read_temp, temp_data);
                
                // Check that data is reasonable (temperature-like)
                expect(Math.min(...read_temp)).toBeGreaterThan(200); // Above absolute zero
                expect(Math.max(...read_temp)).toBeLessThan(350); // Below typical max temp
                
                await nc.close();
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });
    });

    describe('Variable Collections', () => {
        test('should manage variable collections correctly', async () => {
            const filename = TestSetup.getTestFilename('_vars_collections');
            
            if (mockMode) {
                const nc = new NetCDF4(filename, 'w');
                expect(Object.keys(nc.variables)).toHaveLength(0);
                return;
            }

            try {
                const nc = await Dataset(filename, 'w');
                
                await nc.createDimension('time', 10);
                await nc.createDimension('lat', 73);
                await nc.createDimension('lon', 144);
                
                // Initially empty
                expect(Object.keys(nc.variables)).toHaveLength(0);
                
                // Add variables
                await nc.createVariable('temperature', 'f4', ['time', 'lat', 'lon']);
                await nc.createVariable('pressure', 'f4', ['time', 'lat', 'lon']);
                await nc.createVariable('humidity', 'f4', ['time', 'lat', 'lon']);
                await nc.createVariable('wind_speed', 'f4', ['time', 'lat', 'lon']);
                
                // Check collection contents
                const varNames = Object.keys(nc.variables);
                expect(varNames).toHaveLength(4);
                expect(varNames).toContain('temperature');
                expect(varNames).toContain('pressure');
                expect(varNames).toContain('humidity');
                expect(varNames).toContain('wind_speed');
                
                // Check variable access
                expect(nc.variables.temperature.datatype).toBe('f4');
                expect(nc.variables.pressure.dimensions).toEqual(['time', 'lat', 'lon']);
                
                await nc.close();
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });
    });

    describe('Variable Error Handling', () => {
        test('should handle invalid data types', async () => {
            const filename = TestSetup.getTestFilename('_vars_invalid_type');
            
            if (mockMode) {
                pending('WASM module not available');
                return;
            }

            try {
                const nc = await Dataset(filename, 'w');
                
                await nc.createDimension('x', 10);
                
                // Invalid data type should throw error
                expect(async () => {
                    await nc.createVariable('invalid', 'invalid_type' as any, ['x']);
                }).rejects.toThrow('Unsupported datatype');
                
                await nc.close();
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });

        test('should handle undefined dimensions', async () => {
            const filename = TestSetup.getTestFilename('_vars_undefined_dim');
            
            if (mockMode) {
                pending('WASM module not available');
                return;
            }

            try {
                const nc = await Dataset(filename, 'w');
                
                // Reference non-existent dimension
                expect(async () => {
                    await nc.createVariable('test', 'f4', ['nonexistent_dim']);
                }).rejects.toThrow("Dimension 'nonexistent_dim' not found");
                
                await nc.close();
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });

        test('should handle data type mismatches', async () => {
            const filename = TestSetup.getTestFilename('_vars_type_mismatch');
            
            if (mockMode) {
                pending('WASM module not available');
                return;
            }

            try {
                const nc = await Dataset(filename, 'w');
                
                await nc.createDimension('x', 5);
                const int_var = await nc.createVariable('int_data', 'i4', ['x']);
                
                // Currently our implementation only supports f8/double
                // This should throw an error for unsupported data types
                expect(async () => {
                    const data = new Float64Array([1, 2, 3, 4, 5]);
                    await int_var.setValue(data);
                }).rejects.toThrow('Data type i4 not yet supported');
                
                await nc.close();
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });
    });

    describe('Variable Groups', () => {
        test('should handle variables in groups', async () => {
            const filename = TestSetup.getTestFilename('_vars_groups');
            
            if (mockMode) {
                const nc = new NetCDF4(filename, 'w');
                const group = nc.createGroup('forecast');
                expect(Object.keys(group.variables)).toHaveLength(0);
                return;
            }

            try {
                const nc = await Dataset(filename, 'w');
                
                // Create dimensions and variables in root
                await nc.createDimension('time', 10);
                await nc.createDimension('lat', 73);
                await nc.createDimension('lon', 144);
                
                await nc.createVariable('global_temp', 'f4', ['time', 'lat', 'lon']);
                
                // Create group with its own dimensions and variables
                const forecast_group = nc.createGroup('forecast');
                await forecast_group.createDimension('forecast_time', 24);
                await forecast_group.createVariable('forecast_temp', 'f4', ['forecast_time']);
                
                // Check root variables
                expect(Object.keys(nc.variables)).toHaveLength(1);
                expect(nc.variables.global_temp.name).toBe('global_temp');
                
                // Check group variables
                expect(Object.keys(forecast_group.variables)).toHaveLength(1);
                expect(forecast_group.variables.forecast_temp.name).toBe('forecast_temp');
                
                await nc.close();
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });
    });
});