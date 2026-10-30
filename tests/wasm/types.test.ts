// Reading every netCDF data type from types.nc

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { NetCDF4 } from "../../src/index.js";
import { openFixture } from "../helpers.js";

describe("Data types", () => {
    let ds: NetCDF4;

    beforeAll(async () => {
        ds = await openFixture("types.nc");
    });

    afterAll(async () => {
        await ds.close();
    });

    test.each([
        ["i1", new Int8Array([-128, -1, 0, 127])],
        ["u1", new Uint8Array([0, 1, 254, 255])],
        ["i2", new Int16Array([-32768, -1, 0, 32767])],
        ["u2", new Uint16Array([0, 1, 65534, 65535])],
        ["i4", new Int32Array([-(2 ** 31), -1, 0, 2 ** 31 - 1])],
        ["u4", new Uint32Array([0, 1, 2 ** 32 - 2, 2 ** 32 - 1])],
        ["i8", new BigInt64Array([-(2n ** 63n), -1n, 0n, 2n ** 63n - 1n])],
        ["u8", new BigUint64Array([0n, 1n, 2n ** 63n, 2n ** 64n - 1n])],
        ["f4", new Float32Array([-1.5, 0, 0.25, 3e38])],
        ["f8", new Float64Array([Number.NaN, Infinity, -Infinity, 1e300])],
    ])("reads %s", async (name, expected) => {
        expect((await ds.getVariableInfo(name)).dtype).toBe(name);
        expect(await ds.getVariableArray(name)).toEqual(expected);
    });

    test("reads variable-length strings", async () => {
        expect((await ds.getVariableInfo("strings")).dtype).toBe("str");
        expect(await ds.getVariableArray("strings")).toEqual([
            "",
            "hello",
            "ünïcödé",
            "x",
        ]);
    });

    // The rows of a char array are concatenated with their NUL padding
    // dropped, so the result is ["abcdef"]
    test.fails("reads a char array row by row", async () => {
        expect(await ds.getVariableArray("chars")).toEqual([
            "abc",
            "de",
            "f",
            "",
        ]);
    });

    test("reads a scalar", async () => {
        expect((await ds.getVariableInfo("scalar")).shape).toEqual([]);
        expect(await ds.getVariableArray("scalar")).toEqual(
            new Float64Array([42]),
        );
    });

    describe("Enums", () => {
        test("describes the enum type", async () => {
            expect(await ds.getVariableInfo("cloud")).toMatchObject({
                dtype: "enum(u1)",
                dtype_base: "u1",
                enum: { 0: "clear", 1: "cloudy", 255: "missing" },
            });
        });

        test("reads the stored values", async () => {
            expect(await ds.getVariableArray("cloud")).toEqual(
                new Uint8Array([0, 1, 255, 0]),
            );
        });

        test("converts values to names on request", async () => {
            expect(
                await ds.get("cloud", ["all"], undefined, {
                    convertEnumsToNames: true,
                }),
            ).toEqual(["clear", "cloudy", "missing", "clear"]);
        });

        // getAttributeValues has no reader for attributes of a user-defined
        // type: "Unsupported attribute type 32"
        test.fails("opens a file whose enum variable has a _FillValue", async () => {
            const withFill = await openFixture("enum-fill.nc");
            expect(await withFill.getVariableArray("flag")).toEqual(
                new Uint8Array([1, 0]),
            );
        });
    });
});
