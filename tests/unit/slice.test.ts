import { describe, expect, test } from "vitest";
import { all, resolveDim, slice } from "../../src/slice.js";

describe("slice selection compatibility", () => {
    test("all() behaves like slice(0, dimSize, 1)", () => {
        const dimSize = 17;
        expect(resolveDim(all(), dimSize)).toEqual(
            resolveDim(slice(0, dimSize, 1), dimSize),
        );
    });

    test('null and "all" behave like all()', () => {
        const dimSize = 5;
        const expected = resolveDim(all(), dimSize);
        expect(resolveDim(null, dimSize)).toEqual(expected);
        expect(resolveDim("all", dimSize)).toEqual(expected);
    });
});

describe("resolveDim", () => {
    test("collapses scalar indices, counting negative ones from the end", () => {
        expect(resolveDim(2, 5)).toEqual({
            start: 2,
            count: 1,
            step: 1,
            collapsed: true,
        });
        expect(resolveDim(-1, 5)).toMatchObject({ start: 4, count: 1 });
    });

    test("clamps out-of-range indices to the dimension", () => {
        expect(resolveDim(7, 5)).toMatchObject({ start: 4, count: 1 });
        expect(resolveDim(-7, 5)).toMatchObject({ start: 0, count: 1 });
    });

    test("resolves slices like Python, including negative bounds", () => {
        expect(resolveDim(slice(3), 10)).toEqual({
            start: 0,
            count: 3,
            step: 1,
            collapsed: false,
        });
        expect(resolveDim(slice(2, 8, 3), 10)).toMatchObject({
            start: 2,
            count: 2,
            step: 3,
        });
        expect(resolveDim(slice(-3, -1), 10)).toMatchObject({
            start: 7,
            count: 2,
        });
    });

    test("clips slice bounds and reads reversed bounds forward", () => {
        expect(resolveDim(slice(5, 100), 10)).toMatchObject({
            start: 5,
            count: 5,
        });
        expect(resolveDim(slice(8, 2), 10)).toMatchObject({
            start: 2,
            count: 6,
        });
        expect(resolveDim(slice(4, 4), 10)).toMatchObject({ count: 0 });
    });

    test("accepts bigint dimension sizes", () => {
        expect(resolveDim(all(), 4n)).toMatchObject({ start: 0, count: 4 });
    });

    test("rejects non-positive steps", () => {
        expect(() => resolveDim(slice(0, 5, 0), 10)).toThrow(
            "Slice step must be a positive integer",
        );
        expect(() => resolveDim(slice(0, 5, -1), 10)).toThrow(
            "Slice step must be a positive integer",
        );
    });
});
