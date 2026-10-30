// Opening datasets from in-memory sources

import { describe, expect, test } from "vitest";
import { Dataset } from "../../src/index.js";
import { fixtureBytes, openFixture } from "../helpers.js";

describe("Opening datasets", () => {
    const bytes = fixtureBytes("classic.nc");

    test.each([
        ["Uint8Array", () => bytes],
        ["ArrayBuffer", () => bytes.buffer],
        ["Blob", () => new Blob([bytes])],
    ])("opens a %s", async (_, source) => {
        const ds = await Dataset(source());

        expect(ds.isopen).toBe(true);
        expect(await ds.getVariableArray("s")).toEqual(
            new Int16Array([-1, 0, 1]),
        );
        await ds.close();
    });

    test("closes the dataset", async () => {
        const ds = await openFixture("classic.nc");

        await ds.close();

        expect(ds.isopen).toBe(false);
        await expect(ds.getVariableArray("s")).rejects.toThrow();
    });

    test.each([
        ["garbage", new Uint8Array([1, 2, 3, 4])],
        ["empty", new Uint8Array()],
    ])("rejects %s bytes", async (_, data) => {
        await expect(Dataset(data)).rejects.toThrow(
            "Failed to open NetCDF file",
        );
    });

    test("rejects unsupported sources", async () => {
        await expect(Dataset(42 as unknown as Uint8Array)).rejects.toThrow(
            "Invalid source type",
        );
    });

    test("rejects remote files in write mode", async () => {
        await expect(Dataset("https://example.org/x.nc", "w")).rejects.toThrow(
            "Remote files can only be opened read-only",
        );
    });

    // file_format only reflects options.format, not the file
    test.fails("reports the format of a classic file", async () => {
        const ds = await openFixture("classic.nc");
        expect(ds.file_format).toBe("NETCDF3_CLASSIC");
    });
});
