// Integration tests following netcdf4-python comprehensive examples

import { Dataset, NetCDF4, NC_CONSTANTS } from '../index.js';
import { TestSetup } from '../test-setup.js';
import { mockMode } from '../test-setup.js';

describe('Integration Tests', () => {
    // let mockMode = false;

    beforeAll(() => {
        TestSetup.setupTestEnvironment();
        // mockMode = TestSetup.mockWasmModule();
    });

    afterAll(() => {
        TestSetup.cleanupTestEnvironment();
    });

    describe('Complete Workflow Examples', () => {
        test('should create a complete climate dataset following CF conventions', async () => {
            const filename = TestSetup.getTestFilename('_integration_climate');
            
            if (mockMode) {
                pending('WASM module not available');
                return;
            }

            try {
                // Create dataset
                const nc = await Dataset(filename, 'w', { format: 'NETCDF4' });
                
                // Global attributes following CF conventions
                nc.setAttr('Conventions', 'CF-1.8');
                nc.setAttr('title', 'Sample Climate Data');
                nc.setAttr('institution', 'NetCDF4-WASM Test Suite');
                nc.setAttr('source', 'Synthetic test data');
                nc.setAttr('history', new Date().toISOString() + ' created by integration test');
                nc.setAttr('references', 'CF Conventions v1.8');
                nc.setAttr('comment', 'Integration test for complete climate dataset workflow');
                
                // Create dimensions
                const time_dim = await nc.createDimension('time', null); // unlimited
                const lat_dim = await nc.createDimension('lat', 18);      // 10 degree resolution
                const lon_dim = await nc.createDimension('lon', 36);      // 10 degree resolution
                const level_dim = await nc.createDimension('level', 4);   // pressure levels
                
                // Verify dimensions
                expect(time_dim.isUnlimited).toBe(true);
                expect(lat_dim.size).toBe(18);
                expect(lon_dim.size).toBe(36);
                expect(level_dim.size).toBe(4);
                
                // Create coordinate variables
                const time_var = await nc.createVariable('time', 'f8', ['time']);
                time_var.standard_name = 'time';
                time_var.long_name = 'time';
                time_var.units = 'days since 1990-01-01 00:00:00';
                time_var.calendar = 'gregorian';
                time_var.axis = 'T';
                
                const lat_var = await nc.createVariable('lat', 'f4', ['lat']);
                lat_var.standard_name = 'latitude';
                lat_var.long_name = 'latitude';
                lat_var.units = 'degrees_north';
                lat_var.axis = 'Y';
                lat_var.setAttr('valid_min', -90.0);
                lat_var.setAttr('valid_max', 90.0);
                
                const lon_var = await nc.createVariable('lon', 'f4', ['lon']);
                lon_var.standard_name = 'longitude';
                lon_var.long_name = 'longitude';
                lon_var.units = 'degrees_east';
                lon_var.axis = 'X';
                lon_var.setAttr('valid_min', -180.0);
                lon_var.setAttr('valid_max', 180.0);
                
                const level_var = await nc.createVariable('level', 'f4', ['level']);
                level_var.standard_name = 'air_pressure';
                level_var.long_name = 'pressure level';
                level_var.units = 'hPa';
                level_var.axis = 'Z';
                level_var.setAttr('positive', 'down');
                
                // Create data variables
                const temp_var = await nc.createVariable('air_temperature', 'f8', ['time', 'level', 'lat', 'lon']);
                temp_var.standard_name = 'air_temperature';
                temp_var.long_name = 'Air Temperature';
                temp_var.units = 'K';
                temp_var.setAttr('coordinates', 'time level lat lon');
                temp_var.setAttr('cell_methods', 'time: mean');
                temp_var._FillValue = -9999.0;
                temp_var.setAttr('valid_min', 150.0);
                temp_var.setAttr('valid_max', 350.0);
                
                const humidity_var = await nc.createVariable('relative_humidity', 'f8', ['time', 'level', 'lat', 'lon']);
                humidity_var.standard_name = 'relative_humidity';
                humidity_var.long_name = 'Relative Humidity';
                humidity_var.units = '%';
                humidity_var.setAttr('coordinates', 'time level lat lon');
                humidity_var._FillValue = -9999.0;
                humidity_var.setAttr('valid_min', 0.0);
                humidity_var.setAttr('valid_max', 100.0);
                
                const precip_var = await nc.createVariable('precipitation_flux', 'f8', ['time', 'lat', 'lon']);
                precip_var.standard_name = 'precipitation_flux';
                precip_var.long_name = 'Precipitation Rate';
                precip_var.units = 'kg m-2 s-1';
                precip_var.setAttr('coordinates', 'time lat lon');
                precip_var._FillValue = -9999.0;
                precip_var.setAttr('valid_min', 0.0);
                
                // Verify all variables are created
                expect(Object.keys(nc.variables)).toHaveLength(7);
                expect(nc.variables.time).toBeDefined();
                expect(nc.variables.lat).toBeDefined();
                expect(nc.variables.lon).toBeDefined();
                expect(nc.variables.level).toBeDefined();
                expect(nc.variables.air_temperature).toBeDefined();
                expect(nc.variables.relative_humidity).toBeDefined();
                expect(nc.variables.precipitation_flux).toBeDefined();
                
                // Generate and write coordinate data
                const time_data = new Float64Array([0, 1, 2, 3, 4]); // 5 time steps
                await time_var.setValue(time_data);
                
                const lat_data = new Float64Array(18);
                for (let i = 0; i < 18; i++) {
                    lat_data[i] = -85 + i * 10; // -85 to 85 degrees
                }
                await lat_var.setValue(lat_data);
                
                const lon_data = new Float64Array(36);
                for (let i = 0; i < 36; i++) {
                    lon_data[i] = -175 + i * 10; // -175 to 175 degrees
                }
                await lon_var.setValue(lon_data);
                
                const level_data = new Float64Array([1000, 850, 500, 200]); // pressure levels in hPa
                await level_var.setValue(level_data);
                
                // Generate realistic temperature data
                const temp_size = 5 * 4 * 18 * 36; // time * level * lat * lon
                const temp_data = new Float64Array(temp_size);
                for (let t = 0; t < 5; t++) {
                    for (let l = 0; l < 4; l++) {
                        for (let i = 0; i < 18; i++) {
                            for (let j = 0; j < 36; j++) {
                                const idx = t * (4 * 18 * 36) + l * (18 * 36) + i * 36 + j;
                                const lat = lat_data[i];
                                const pressure_factor = level_data[l] / 1000.0; // pressure effect
                                const seasonal_factor = Math.cos(t * 0.5); // seasonal variation
                                // Temperature decreases with latitude and altitude
                                temp_data[idx] = 288.15 - Math.abs(lat) * 0.5 - (1000 - level_data[l]) * 0.0065 + seasonal_factor * 5;
                            }
                        }
                    }
                }
                await temp_var.setValue(temp_data);
                
                // Generate humidity data
                const humidity_size = temp_size;
                const humidity_data = new Float64Array(humidity_size);
                for (let i = 0; i < humidity_size; i++) {
                    // Humidity generally decreases with altitude and varies with temperature
                    const temp = temp_data[i];
                    humidity_data[i] = Math.max(10, Math.min(100, 100 - (300 - temp) * 0.3 + Math.random() * 20));
                }
                await humidity_var.setValue(humidity_data);
                
                // Generate precipitation data
                const precip_size = 5 * 18 * 36; // time * lat * lon
                const precip_data = new Float64Array(precip_size);
                for (let t = 0; t < 5; t++) {
                    for (let i = 0; i < 18; i++) {
                        for (let j = 0; j < 36; j++) {
                            const idx = t * (18 * 36) + i * 36 + j;
                            const lat = lat_data[i];
                            // More precipitation near equator and in certain seasons
                            const equatorial_factor = Math.exp(-Math.abs(lat) / 30);
                            const seasonal_factor = Math.max(0, Math.sin(t * 0.8));
                            precip_data[idx] = equatorial_factor * seasonal_factor * 1e-6 * (0.5 + Math.random());
                        }
                    }
                }
                await precip_var.setValue(precip_data);
                
                // Verify data integrity by reading back
                const read_temp = await temp_var.getValue();
                const read_humidity = await humidity_var.getValue();
                const read_precip = await precip_var.getValue();
                
                expect(read_temp.length).toBe(temp_size);
                expect(read_humidity.length).toBe(humidity_size);
                expect(read_precip.length).toBe(precip_size);
                
                // Spot check some values
                expect(read_temp[0]).toBeCloseTo(temp_data[0]);
                expect(read_humidity[100]).toBeCloseTo(humidity_data[100]);
                expect(read_precip[50]).toBeCloseTo(precip_data[50]);
                
                // Verify global attributes
                expect(nc.getAttr('Conventions')).toBe('CF-1.8');
                expect(nc.getAttr('title')).toBe('Sample Climate Data');
                
                // Verify variable attributes
                expect(temp_var.standard_name).toBe('air_temperature');
                expect(temp_var.units).toBe('K');
                expect(humidity_var.units).toBe('%');
                expect(precip_var.units).toBe('kg m-2 s-1');
                
                await nc.close();
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });

        test('should create a multi-group hierarchical dataset', async () => {
            const filename = TestSetup.getTestFilename('_integration_groups');
            
            if (mockMode) {
                // Test the interface even without WASM
                const nc = new NetCDF4(filename, 'w');
                nc.setAttr('title', 'Multi-Group Dataset');
                
                const obs_group = nc.createGroup('observations');
                const model_group = nc.createGroup('model');
                
                obs_group.setAttr('description', 'Observational data');
                model_group.setAttr('description', 'Model output');
                
                expect(Object.keys(nc.groups)).toHaveLength(2);
                expect(nc.groups.observations).toBe(obs_group);
                expect(nc.groups.model).toBe(model_group);
                return;
            }

            try {
                const nc = await Dataset(filename, 'w', { format: 'NETCDF4' });
                
                // Root level attributes
                nc.setAttr('title', 'Multi-Group Meteorological Dataset');
                nc.setAttr('institution', 'Integration Test Suite');
                nc.setAttr('Conventions', 'CF-1.8');
                
                // Create groups for different data types
                const obs_group = nc.createGroup('observations');
                const model_group = nc.createGroup('model');
                const analysis_group = nc.createGroup('analysis');
                
                // Observations group
                obs_group.setAttr('description', 'Surface weather station observations');
                obs_group.setAttr('source', 'Automatic weather stations');
                
                await obs_group.createDimension('station', 100);
                await obs_group.createDimension('obs_time', null);
                
                const station_temp = await obs_group.createVariable('temperature', 'f8', ['obs_time', 'station']);
                station_temp.standard_name = 'air_temperature';
                station_temp.units = 'K';
                
                // Model group
                model_group.setAttr('description', 'Numerical weather prediction model output');
                model_group.setAttr('model_name', 'Test Model v1.0');
                
                await model_group.createDimension('model_time', 24);
                await model_group.createDimension('grid_x', 50);
                await model_group.createDimension('grid_y', 50);
                
                const model_temp = await model_group.createVariable('temperature', 'f8', ['model_time', 'grid_y', 'grid_x']);
                model_temp.standard_name = 'air_temperature';
                model_temp.units = 'K';
                
                // Analysis group
                analysis_group.setAttr('description', 'Data analysis results');
                analysis_group.setAttr('analysis_method', 'Statistical comparison');
                
                await analysis_group.createDimension('region', 10);
                const bias = await analysis_group.createVariable('model_bias', 'f8', ['region']);
                bias.long_name = 'Model temperature bias';
                bias.units = 'K';
                
                // Verify group structure
                expect(Object.keys(nc.groups)).toHaveLength(3);
                expect(nc.groups.observations).toBeDefined();
                expect(nc.groups.model).toBeDefined();
                expect(nc.groups.analysis).toBeDefined();
                
                // Verify group attributes
                expect(obs_group.getAttr('source')).toBe('Automatic weather stations');
                expect(model_group.getAttr('model_name')).toBe('Test Model v1.0');
                expect(analysis_group.getAttr('analysis_method')).toBe('Statistical comparison');
                
                // Verify dimensions and variables in groups
                expect(Object.keys(obs_group.dimensions)).toContain('station');
                expect(Object.keys(model_group.dimensions)).toContain('grid_x');
                expect(Object.keys(analysis_group.dimensions)).toContain('region');
                
                expect(Object.keys(obs_group.variables)).toContain('temperature');
                expect(Object.keys(model_group.variables)).toContain('temperature');
                expect(Object.keys(analysis_group.variables)).toContain('model_bias');
                
                await nc.close();
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });

        test('should handle complex dataset read/write workflow', async () => {
            const filename = TestSetup.getTestFilename('_integration_workflow');
            
            if (mockMode) {
                pending('WASM module not available');
                return;
            }

            try {
                // Phase 1: Create and write dataset
                let nc = await Dataset(filename, 'w');
                
                nc.setAttr('phase', 'creation');
                nc.setAttr('created', new Date().toISOString());
                
                await nc.createDimension('time', 10);
                await nc.createDimension('location', 20);
                
                const data_var = await nc.createVariable('measurements', 'f8', ['time', 'location']);
                data_var.units = 'degC';
                data_var.long_name = 'Temperature measurements';
                data_var._FillValue = -999.0;
                
                // Generate test data
                const write_data = new Float64Array(10 * 20);
                for (let t = 0; t < 10; t++) {
                    for (let l = 0; l < 20; l++) {
                        write_data[t * 20 + l] = 20 + 10 * Math.sin(t * 0.5) + 5 * Math.cos(l * 0.3);
                    }
                }
                
                await data_var.setValue(write_data);
                await nc.close();
                
                // Phase 2: Read and verify dataset
                nc = await Dataset(filename, 'r');
                
                expect(nc.getAttr('phase')).toBe('creation');
                expect(nc.getAttr('created')).toBeDefined();
                
                expect(Object.keys(nc.dimensions)).toContain('time');
                expect(Object.keys(nc.dimensions)).toContain('location');
                expect(nc.dimensions.time.size).toBe(10);
                expect(nc.dimensions.location.size).toBe(20);
                
                expect(Object.keys(nc.variables)).toContain('measurements');
                const read_var = nc.variables.measurements;
                expect(read_var.units).toBe('degC');
                expect(read_var.long_name).toBe('Temperature measurements');
                expect(read_var._FillValue).toBe(-999.0);
                
                const read_data = await read_var.getValue();
                expect(read_data.length).toBe(200);
                TestSetup.assertArraysAlmostEqual(read_data, write_data);
                
                await nc.close();
                
                // Phase 3: Append mode (modify existing file)
                nc = await Dataset(filename, 'a');
                
                nc.setAttr('phase', 'modification');
                nc.setAttr('modified', new Date().toISOString());
                
                // Add new variable
                const quality_var = await nc.createVariable('quality_flags', 'f8', ['time', 'location']);
                quality_var.long_name = 'Data quality indicators';
                quality_var.setAttr('flag_values', '0, 1, 2, 3');
                quality_var.setAttr('flag_meanings', 'good questionable bad missing');
                
                // Generate quality data
                const quality_data = new Float64Array(10 * 20);
                for (let i = 0; i < quality_data.length; i++) {
                    quality_data[i] = Math.floor(Math.random() * 4); // 0-3 quality flags
                }
                
                await quality_var.setValue(quality_data);
                await nc.close();
                
                // Phase 4: Final verification
                nc = await Dataset(filename, 'r');
                
                expect(nc.getAttr('phase')).toBe('modification');
                expect(nc.getAttr('created')).toBeDefined();
                expect(nc.getAttr('modified')).toBeDefined();
                
                expect(Object.keys(nc.variables)).toHaveLength(2);
                expect(nc.variables.measurements).toBeDefined();
                expect(nc.variables.quality_flags).toBeDefined();
                
                const final_data = await nc.variables.measurements.getValue();
                const final_quality = await nc.variables.quality_flags.getValue();
                
                TestSetup.assertArraysAlmostEqual(final_data, write_data);
                expect(final_quality.length).toBe(200);
                
                // Verify all quality flags are in valid range
                for (let i = 0; i < final_quality.length; i++) {
                    expect(final_quality[i]).toBeGreaterThanOrEqual(0);
                    expect(final_quality[i]).toBeLessThanOrEqual(3);
                }
                
                await nc.close();
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });
    });

    describe('Error Recovery and Edge Cases', () => {
        test('should handle incomplete dataset creation gracefully', async () => {
            const filename = TestSetup.getTestFilename('_integration_incomplete');
            
            if (mockMode) {
                pending('WASM module not available');
                return;
            }

            try {
                const nc = await Dataset(filename, 'w');
                
                // Create dimensions
                await nc.createDimension('x', 10);
                await nc.createDimension('y', 20);
                
                // Create variable but don't write data
                const var1 = await nc.createVariable('incomplete', 'f8', ['x', 'y']);
                var1.units = 'test_units';
                
                // Close without writing data (should still be valid)
                await nc.close();
                
                // Reopen and verify structure exists
                const nc2 = await Dataset(filename, 'r');
                
                expect(Object.keys(nc2.dimensions)).toHaveLength(2);
                expect(Object.keys(nc2.variables)).toHaveLength(1);
                expect(nc2.variables.incomplete.units).toBe('test_units');
                
                await nc2.close();
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });

        test('should handle mixed data types in complex scenarios', async () => {
            const filename = TestSetup.getTestFilename('_integration_mixed_types');
            
            if (mockMode) {
                pending('WASM module not available');
                return;
            }

            try {
                const nc = await Dataset(filename, 'w');
                
                // Create various dimension sizes
                await nc.createDimension('tiny', 1);
                await nc.createDimension('small', 5);
                await nc.createDimension('medium', 50);
                await nc.createDimension('large', 500);
                await nc.createDimension('unlimited', null);
                
                // Create variables with different type combinations
                const scalar = await nc.createVariable('scalar', 'f8', []);
                const tiny_array = await nc.createVariable('tiny_data', 'f8', ['tiny']);
                const multi_dim = await nc.createVariable('multi_data', 'f8', ['small', 'medium']);
                const unlimited_var = await nc.createVariable('time_series', 'f8', ['unlimited', 'small']);
                
                // Set comprehensive attributes
                const vars = [scalar, tiny_array, multi_dim, unlimited_var];
                vars.forEach((v, i) => {
                    v.long_name = `Test variable ${i}`;
                    v.units = 'dimensionless';
                    v.setAttr('creation_order', i);
                    v._FillValue = -9999.0;
                });
                
                // Write data to each variable
                await scalar.setValue(new Float64Array([42.0]));
                await tiny_array.setValue(new Float64Array([1.0]));
                
                const medium_data = TestSetup.createTestData([5, 50]);
                await multi_dim.setValue(medium_data);
                
                const time_data = TestSetup.createTestData([3, 5]); // 3 time steps
                await unlimited_var.setValue(time_data);
                
                // Verify everything
                expect((await scalar.getValue())[0]).toBeCloseTo(42.0);
                expect((await tiny_array.getValue())[0]).toBeCloseTo(1.0);
                
                const read_medium = await multi_dim.getValue();
                TestSetup.assertArraysAlmostEqual(read_medium, medium_data);
                
                const read_time = await unlimited_var.getValue();
                TestSetup.assertArraysAlmostEqual(read_time, time_data);
                
                await nc.close();
            } finally {
                TestSetup.cleanupTestFile(filename);
            }
        });
    });
});