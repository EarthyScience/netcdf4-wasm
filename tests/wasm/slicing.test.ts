// Partial reads of basic.nc, where temp[t, y, x] = 100 * t + 10 * y + x

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { type NetCDF4, slice } from "../../src/index.js";
import { openFixture } from "../helpers.js";

const temp = (t: number, y: number, x: number) => 100 * t + 10 * y + x;

describe("Slicing", () => {
    let ds: NetCDF4;

    beforeAll(async () => {
        ds = await openFixture("basic.nc");
    });

    afterAll(async () => {
        await ds.close();
    });

    test("reads a whole variable in C order", async () => {
        const expected = [];
        for (let t = 0; t < 3; t++)
            for (let y = 0; y < 4; y++)
                for (let x = 0; x < 5; x++) expected.push(temp(t, y, x));

        expect(await ds.getVariableArray("temp")).toEqual(
            new Float32Array(expected),
        );
        expect(await ds.get("temp", [null, "all", null])).toEqual(
            new Float32Array(expected),
        );
    });

    test("selects single indices", async () => {
        expect(await ds.get("temp", [1, "all", 2])).toEqual(
            new Float32Array([
                temp(1, 0, 2),
                temp(1, 1, 2),
                temp(1, 2, 2),
                temp(1, 3, 2),
            ]),
        );
        expect(await ds.get("temp", [-1, 0, -1])).toEqual(
            new Float32Array([temp(2, 0, 4)]),
        );
    });

    test("selects ranges with steps", async () => {
        expect(
            await ds.get("temp", [slice(0, 3, 2), slice(1, 3), slice(4)]),
        ).toEqual(
            new Float32Array(
                [0, 2].flatMap((t) =>
                    [1, 2].flatMap((y) =>
                        [0, 1, 2, 3].map((x) => temp(t, y, x)),
                    ),
                ),
            ),
        );
    });

    test("rejects a selection with the wrong number of dimensions", async () => {
        await expect(ds.get("temp", [0])).rejects.toThrow(
            "Selection has 1 dimension(s) but variable has 3",
        );
    });

    test("reads a hyperslab by start and count", async () => {
        expect(
            await ds.getSlicedVariableArray("temp", [1, 1, 1], [1, 2, 3]),
        ).toEqual(new Float32Array([111, 112, 113, 121, 122, 123]));
    });

    test("rejects a hyperslab beyond the variable", async () => {
        await expect(
            ds.getSlicedVariableArray("temp", [0, 0, 0], [9, 9, 9]),
        ).rejects.toThrow("Failed to read sliced array data");
    });

    test("reads through Variable.getValue", async () => {
        const data = await ds.variables.temp.getValue();

        expect(data).toBeInstanceOf(Float32Array);
        expect(data).toHaveLength(60);
        expect(data[59]).toBe(temp(2, 3, 4));
    });
});
