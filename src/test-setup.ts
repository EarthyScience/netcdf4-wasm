// Test setup utilities following netcdf4-python patterns
import { Dataset, NetCDF4, NC_CONSTANTS } from './index.js';
import * as fs from 'fs';
import * as path from 'path';

export class TestSetup {
    private static testDir = '/tmp/netcdf4-wasm-tests';
    private static fileCounter = 0;

    static setupTestEnvironment(): void {
        // Create test directory if it doesn't exist
        if (!fs.existsSync(this.testDir)) {
            fs.mkdirSync(this.testDir, { recursive: true });
        }
    }

    static getTestFilename(suffix: string = ''): string {
        this.fileCounter++;
        const filename = `test_${this.fileCounter}${suffix}.nc`;
        return path.join(this.testDir, filename);
    }

    static cleanupTestFile(filename: string): void {
        try {
            if (fs.existsSync(filename)) {
                fs.unlinkSync(filename);
            }
        } catch (error) {
            // Ignore cleanup errors in tests
        }
    }

    static cleanupTestEnvironment(): void {
        try {
            if (fs.existsSync(this.testDir)) {
                const files = fs.readdirSync(this.testDir);
                for (const file of files) {
                    fs.unlinkSync(path.join(this.testDir, file));
                }
                fs.rmdirSync(this.testDir);
            }
        } catch (error) {
            // Ignore cleanup errors
        }
    }

    
    // Create test data arrays
    static createTestData(shape: number[]): Float64Array {
        const size = shape.reduce((a, b) => a * b, 1);
        const data = new Float64Array(size);
        for (let i = 0; i < size; i++) {
            data[i] = i * 0.1; // Simple test pattern
        }
        return data;
    }

    // Create temperature test data (common in netCDF examples)
    static createTemperatureData(nlat: number, nlon: number): Float64Array {
        const data = new Float64Array(nlat * nlon);
        for (let i = 0; i < nlat; i++) {
            for (let j = 0; j < nlon; j++) {
                // Simple temperature pattern: varies with latitude
                const lat = -90 + (i * 180) / (nlat - 1);
                data[i * nlon + j] = 273.15 + 30 * Math.cos((lat * Math.PI) / 180);
            }
        }
        return data;
    }

    // Assert arrays are approximately equal (for floating point comparisons)
    static assertArraysAlmostEqual(
        actual: Float64Array | Float32Array,
        expected: Float64Array | Float32Array,
        tolerance: number = 1e-10
    ): void {
        expect(actual.length).toBe(expected.length);
        for (let i = 0; i < actual.length; i++) {
            expect(Math.abs(actual[i] - expected[i])).toBeLessThanOrEqual(tolerance);
        }
    }
}

export const mockMode = (() => {
    const g = globalThis as any;
    if (typeof g.NetCDF4Module === 'undefined') {
        g.NetCDF4Module = jest.fn().mockRejectedValue(
            new Error('NetCDF4Module not available in test environment')
        );
        return true;
    }
    return false;
})();