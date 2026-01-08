// Basic tests for memory-based dataset functionality (Blob/ArrayBuffer support)

import { NetCDF4, Dataset, DatasetFromBlob, DatasetFromArrayBuffer, DatasetFromMemory } from '../index.js';
import { TestSetup } from '../test-setup.js';

describe('Memory-based Dataset Basic Tests', () => {
    beforeAll(() => {
        TestSetup.setupTestEnvironment();
    });

    afterAll(() => {
        TestSetup.cleanupTestEnvironment();
    });

    describe('Factory Method Creation', () => {
        test('should create dataset from ArrayBuffer', async () => {
            const buffer = new ArrayBuffer(1024);
            const view = new Uint8Array(buffer);
            for (let i = 0; i < view.length; i++) {
                view[i] = i % 256;
            }

            const dataset = await NetCDF4.fromArrayBuffer(buffer, 'r');
            
            expect(dataset).toBeInstanceOf(NetCDF4);
            expect(dataset.isInitialized()).toBe(true);
            expect(dataset.toString()).toContain('(in-memory)');
            
            await dataset.close();
        });

        test('should create dataset from Uint8Array', async () => {
            const data = new Uint8Array(512);
            for (let i = 0; i < data.length; i++) {
                data[i] = (i * 2) % 256;
            }

            const dataset = await NetCDF4.fromMemory(data, 'r');
            
            expect(dataset).toBeInstanceOf(NetCDF4);
            expect(dataset.isInitialized()).toBe(true);
            expect(dataset.toString()).toContain('(in-memory)');
            
            await dataset.close();
        });

        test('should create dataset from Blob using static method', async () => {
            if (typeof Blob === 'undefined') {
                pending('Blob not available in this environment');
                return;
            }

            const data = new Uint8Array(256);
            for (let i = 0; i < data.length; i++) {
                data[i] = i;
            }
            const blob = new Blob([data], { type: 'application/x-netcdf' });

            const dataset = await NetCDF4.fromBlob(blob, 'r');
            
            expect(dataset).toBeInstanceOf(NetCDF4);
            expect(dataset.isInitialized()).toBe(true);
            expect(dataset.toString()).toContain('(in-memory)');
            
            await dataset.close();
        });

        test('should create dataset with custom filename', async () => {
            const data = new Uint8Array(128);
            const customFilename = '/tmp/custom_test.nc';

            const dataset = await NetCDF4.fromMemory(data, 'r', {}, customFilename);
            
            expect(dataset.filepath).toBe(customFilename);
            expect(dataset.toString()).toContain(customFilename);
            
            await dataset.close();
        });
    });

    describe('Polymorphic Dataset Constructor', () => {
        test('should route ArrayBuffer to fromArrayBuffer', async () => {
            const buffer = new ArrayBuffer(256);
            const dataset = await Dataset(buffer, 'r');
            
            expect(dataset).toBeInstanceOf(NetCDF4);
            expect(dataset.toString()).toContain('(in-memory)');
            
            await dataset.close();
        });

        test('should route Uint8Array to fromMemory', async () => {
            const data = new Uint8Array(128);
            const dataset = await Dataset(data, 'r');
            
            expect(dataset).toBeInstanceOf(NetCDF4);
            expect(dataset.toString()).toContain('(in-memory)');
            
            await dataset.close();
        });

        test('should route Blob to fromBlob', async () => {
            if (typeof Blob === 'undefined') {
                pending('Blob not available in this environment');
                return;
            }

            const data = new Uint8Array(64);
            const blob = new Blob([data]);
            const dataset = await Dataset(blob, 'r');
            
            expect(dataset).toBeInstanceOf(NetCDF4);
            expect(dataset.toString()).toContain('(in-memory)');
            
            await dataset.close();
        });

        test('should route string to traditional Dataset', async () => {
            const dataset = await Dataset('test.nc', 'w');
            
            expect(dataset).toBeInstanceOf(NetCDF4);
            expect(dataset.filepath).toBe('test.nc');
            
            await dataset.close();
        });

        test('should throw error for invalid source type', async () => {
            await expect(async () => {
                await Dataset(123 as any, 'r');
            }).rejects.toThrow('Invalid source type');
        });
    });

    describe('Legacy Convenience Functions', () => {
        test('should work with DatasetFromArrayBuffer function', async () => {
            const buffer = new ArrayBuffer(256);
            const dataset = await DatasetFromArrayBuffer(buffer, 'r');
            
            expect(dataset).toBeInstanceOf(NetCDF4);
            expect(dataset.isInitialized()).toBe(true);
            
            await dataset.close();
        });

        test('should work with DatasetFromMemory function', async () => {
            const data = new Uint8Array(128);
            const dataset = await DatasetFromMemory(data, 'r');
            
            expect(dataset).toBeInstanceOf(NetCDF4);
            expect(dataset.isInitialized()).toBe(true);
            
            await dataset.close();
        });

        test('should work with DatasetFromBlob function', async () => {
            if (typeof Blob === 'undefined') {
                pending('Blob not available in this environment');
                return;
            }

            const data = new Uint8Array(64);
            const blob = new Blob([data]);
            const dataset = await DatasetFromBlob(blob, 'r');
            
            expect(dataset).toBeInstanceOf(NetCDF4);
            expect(dataset.isInitialized()).toBe(true);
            
            await dataset.close();
        });
    });

    describe('Basic Operations', () => {
        test('should support basic dataset structure creation', async () => {
            const data = new Uint8Array(1024);
            const dataset = await NetCDF4.fromMemory(data, 'w');
            
            try {
                // Test basic operations
                expect(dataset.file_format).toBeDefined();
                expect(dataset.isopen).toBe(true);
                
                // Create dimension
                const dim = await dataset.createDimension('test_dim', 10);
                expect(dim.size).toBe(10);
                expect(dim.name).toBe('test_dim');
                
                // Create variable
                const variable = await dataset.createVariable('test_var', 'f8', ['test_dim']);
                expect(variable.name).toBe('test_var');
                expect(variable.datatype).toBe('f8');
                expect(variable.dimensions).toEqual(['test_dim']);
                
                // Verify collections
                expect(Object.keys(dataset.dimensions)).toContain('test_dim');
                expect(Object.keys(dataset.variables)).toContain('test_var');
                
            } finally {
                await dataset.close();
            }
        });

        test('should handle attributes on memory datasets', async () => {
            const data = new Uint8Array(512);
            const dataset = await NetCDF4.fromMemory(data, 'w');
            
            try {
                // Set global attributes
                dataset.setAttr('title', 'Memory Dataset Test');
                dataset.setAttr('version', 1.0);
                dataset.setAttr('created_by', 'netcdf4-wasm test suite');
                
                // Verify attributes
                expect(dataset.getAttr('title')).toBe('Memory Dataset Test');
                expect(dataset.getAttr('version')).toBe(1.0);
                expect(dataset.getAttr('created_by')).toBe('netcdf4-wasm test suite');
                
                // List all attributes
                const attrs = dataset.attrs();
                expect(attrs).toContain('title');
                expect(attrs).toContain('version');
                expect(attrs).toContain('created_by');
                
            } finally {
                await dataset.close();
            }
        });

        test('should support variable attributes', async () => {
            const dataset = await NetCDF4.fromMemory(new Uint8Array(512), 'w');
            
            try {
                await dataset.createDimension('x', 5);
                const variable = await dataset.createVariable('temperature', 'f8', ['x']);
                
                // Set attributes using properties
                variable.units = 'K';
                variable.long_name = 'Air Temperature';
                
                // Set attributes using method
                variable.setAttr('valid_range', [200, 320]);
                variable.setAttr('_FillValue', -9999.0);
                
                // Verify attributes
                expect(variable.units).toBe('K');
                expect(variable.long_name).toBe('Air Temperature');
                expect(variable.getAttr('valid_range')).toEqual([200, 320]);
                expect(variable.getAttr('_FillValue')).toBe(-9999.0);
                
            } finally {
                await dataset.close();
            }
        });
    });

    describe('Error Handling', () => {
        test('should handle null/undefined data', async () => {
            await expect(async () => {
                await NetCDF4.fromMemory(null as any, 'r');
            }).rejects.toThrow('Data cannot be null or undefined');
            
            await expect(async () => {
                await NetCDF4.fromMemory(undefined as any, 'r');
            }).rejects.toThrow('Data cannot be null or undefined');
        });

        test('should handle invalid data types', async () => {
            await expect(async () => {
                await NetCDF4.fromMemory('not an array' as any, 'r');
            }).rejects.toThrow('Data must be ArrayBuffer or Uint8Array');
            
            await expect(async () => {
                await NetCDF4.fromMemory(123 as any, 'r');
            }).rejects.toThrow('Data must be ArrayBuffer or Uint8Array');
        });

        test('should handle invalid mode', async () => {
            const data = new Uint8Array(128);
            
            await expect(async () => {
                await NetCDF4.fromMemory(data, 'invalid_mode' as any);
            }).rejects.toThrow();
        });

        test('should handle empty data gracefully', async () => {
            const emptyData = new Uint8Array(0);
            
            await expect(async () => {
                const dataset = await NetCDF4.fromMemory(emptyData, 'r');
                await dataset.close();
            }).not.toThrow();
        });
    });

    describe('Export Operations', () => {
        test('should export to ArrayBuffer', async () => {
            const originalData = new Uint8Array(256);
            const dataset = await NetCDF4.fromMemory(originalData, 'w');
            
            try {
                await dataset.createDimension('x', 4);
                const variable = await dataset.createVariable('data', 'f8', ['x']);
                
                const exportedBuffer = await dataset.toArrayBuffer();
                expect(exportedBuffer).toBeInstanceOf(ArrayBuffer);
                expect(exportedBuffer.byteLength).toBeGreaterThanOrEqual(0);
                
            } finally {
                await dataset.close();
            }
        });

        test('should export to Blob', async () => {
            if (typeof Blob === 'undefined') {
                pending('Blob not available in this environment');
                return;
            }

            const originalData = new Uint8Array(128);
            const dataset = await NetCDF4.fromMemory(originalData, 'w');
            
            try {
                await dataset.createDimension('y', 2);
                const variable = await dataset.createVariable('values', 'f8', ['y']);
                
                const blob = await dataset.toBlob();
                expect(blob).toBeInstanceOf(Blob);
                expect(blob.type).toBe('application/x-netcdf');
                expect(blob.size).toBeGreaterThanOrEqual(0);
                
            } finally {
                await dataset.close();
            }
        });

        test('should export to Blob with custom MIME type', async () => {
            if (typeof Blob === 'undefined') {
                pending('Blob not available in this environment');
                return;
            }

            const originalData = new Uint8Array(64);
            const dataset = await NetCDF4.fromMemory(originalData, 'w');
            
            try {
                const blob = await dataset.toBlob('application/octet-stream');
                expect(blob.type).toBe('application/octet-stream');
                
            } finally {
                await dataset.close();
            }
        });
    });

    describe('Integration with Existing Patterns', () => {
        test('should work with existing dimension creation patterns', async () => {
            const dataset = await NetCDF4.fromMemory(new Uint8Array(512), 'w');
            
            try {
                // This should work exactly like file-based datasets
                const timeDim = await dataset.createDimension('time', 10);
                const latDim = await dataset.createDimension('lat', 90);
                const lonDim = await dataset.createDimension('lon', 180);
                const unlimitedDim = await dataset.createDimension('record', null);
                
                expect(timeDim.size).toBe(10);
                expect(latDim.size).toBe(90);
                expect(lonDim.size).toBe(180);
                expect(unlimitedDim.isUnlimited).toBe(true);
                
                expect(Object.keys(dataset.dimensions)).toHaveLength(4);
                
            } finally {
                await dataset.close();
            }
        });

        test('should work with existing variable creation patterns', async () => {
            const dataset = await NetCDF4.fromMemory(new Uint8Array(1024), 'w');
            
            try {
                await dataset.createDimension('time', 5);
                await dataset.createDimension('lat', 10);
                await dataset.createDimension('lon', 20);
                
                // Test all the patterns from existing tests
                const temp = await dataset.createVariable('temperature', 'f8', ['time', 'lat', 'lon']);
                const pressure = await dataset.createVariable('pressure', 'f4', ['time', 'lat', 'lon']);
                const timeVar = await dataset.createVariable('time', 'f8', ['time']);
                
                // Set attributes using both methods
                temp.units = 'K';
                temp.setAttr('long_name', 'Air Temperature');
                pressure.setAttr('units', 'Pa');
                
                expect(temp.units).toBe('K');
                expect(temp.getAttr('long_name')).toBe('Air Temperature');
                expect(pressure.getAttr('units')).toBe('Pa');
                
                // Verify dimensions are correct
                expect(temp.dimensions).toEqual(['time', 'lat', 'lon']);
                expect(pressure.dimensions).toEqual(['time', 'lat', 'lon']);
                expect(timeVar.dimensions).toEqual(['time']);
                
            } finally {
                await dataset.close();
            }
        });

        test('should maintain consistency with file-based operations', async () => {
            // Create equivalent datasets: one in memory, one as file
            const memoryDataset = await NetCDF4.fromMemory(new Uint8Array(1024), 'w');
            const fileDataset = await Dataset('test_consistency.nc', 'w');
            
            try {
                // Apply identical operations to both
                const datasets = [memoryDataset, fileDataset];
                
                for (const dataset of datasets) {
                    dataset.setAttr('title', 'Consistency Test');
                    dataset.setAttr('version', 1.0);
                    
                    await dataset.createDimension('x', 5);
                    await dataset.createDimension('y', 10);
                    
                    const dataVar = await dataset.createVariable('data', 'f8', ['x', 'y']);
                    dataVar.units = 'meters';
                    dataVar.long_name = 'Test Data';
                }
                
                // Verify both have identical structure
                expect(memoryDataset.getAttr('title')).toBe(fileDataset.getAttr('title'));
                expect(memoryDataset.getAttr('version')).toBe(fileDataset.getAttr('version'));
                
                expect(Object.keys(memoryDataset.dimensions)).toEqual(Object.keys(fileDataset.dimensions));
                expect(Object.keys(memoryDataset.variables)).toEqual(Object.keys(fileDataset.variables));
                
                expect(memoryDataset.variables.data.dimensions).toEqual(fileDataset.variables.data.dimensions);
                expect(memoryDataset.variables.data.units).toBe(fileDataset.variables.data.units);
                
            } finally {
                await memoryDataset.close();
                await fileDataset.close();
                TestSetup.cleanupTestFile('test_consistency.nc');
            }
        });
    });
});