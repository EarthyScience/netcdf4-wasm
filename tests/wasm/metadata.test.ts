// Dimensions, variables and attributes of basic.nc

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { NetCDF4 } from "../../src/index.js";
import { openFixture } from "../helpers.js";

describe("Metadata", () => {
    let ds: NetCDF4;

    beforeAll(async () => {
        ds = await openFixture("basic.nc");
    });

    afterAll(async () => {
        await ds.close();
    });

    test("loads the dimensions", () => {
        expect(
            Object.values(ds.dimensions).map((d) => [d.name, d.size]),
        ).toEqual([
            ["time", 3],
            ["lat", 4],
            ["lon", 5],
        ]);
    });

    // Group.load creates every dimension with isUnlimited = false
    test.fails("detects the unlimited dimension", () => {
        expect(ds.dimensions.time.isUnlimited).toBe(true);
    });

    test("returns dimensions with the units of their coordinate variable", async () => {
        expect(await ds.getDims()).toEqual({
            time: { size: 3, units: "days since 2000-01-01", id: 0 },
            lat: { size: 4, units: "degrees_north", id: 1 },
            lon: { size: 5, units: "degrees_east", id: 2 },
        });
    });

    test("lists data variables but not coordinate variables", async () => {
        expect(Object.keys(ds.variables)).toEqual(["temp"]);
        expect(await ds.getVariableArray("lat")).toEqual(
            new Float32Array([-45, -15, 15, 45]),
        );
    });

    test("loads global attributes, numeric ones as arrays", () => {
        expect(
            Object.fromEntries(ds.attrs().map((k) => [k, ds.getAttr(k)])),
        ).toEqual({
            title: "netcdf4-wasm test fixture",
            Conventions: "CF-1.8",
            version: [3],
            pi: [Math.PI],
            valid_range: [0, 100],
        });
    });

    test("loads variable attributes", () => {
        const temp = ds.variables.temp;

        expect(temp.attrs()).toEqual(["units", "long_name"]);
        expect(temp.units).toBe("K");
        expect(temp.long_name).toBe("temperature");
    });

    test("describes a variable", async () => {
        expect(await ds.getVariableInfo("temp")).toMatchObject({
            name: "temp",
            dtype: "f4",
            shape: [3, 4, 5],
            dimensions: ["time", "lat", "lon"],
            size: 60,
            totalSize: 240,
            attributes: { units: "K", long_name: "temperature" },
            chunked: true,
            chunks: [1, 4, 5],
            chunkSize: 80,
        });
    });

    // getVariableInfo ignores the failed name lookup and describes varid 0
    test.fails("rejects an unknown variable name", async () => {
        await expect(ds.getVariableInfo("nope")).rejects.toThrow();
    });

    test("rejects reading an unknown variable", async () => {
        await expect(ds.getVariableArray("nope")).rejects.toThrow(
            "Failed to get variable id for 'nope'",
        );
    });

    test("returns the metadata of every variable", async () => {
        const metadata = await ds.getFullMetadata();

        expect(metadata.map((m) => [m.name, m.dtype, m.shape])).toEqual([
            ["time", "f8", [3]],
            ["lat", "f4", [4]],
            ["lon", "f4", [5]],
            ["temp", "f4", [3, 4, 5]],
        ]);
    });
});
