// Every fixture holds data[y, x] = (50 * y + x) % 97 with shape [40, 50]

import { describe, expect, test } from "vitest";
import { slice } from "../../src/index.js";
import { openFixture } from "../helpers.js";

const expected = Float32Array.from({ length: 40 * 50 }, (_, i) => i % 97);

describe("Compression filters", () => {
    test.each([
        "none",
        "zlib",
        "zlib-shuffle",
        "zstd",
        "bzip2",
        "blosc_lz",
        "blosc_lz4",
        "blosc_lz4hc",
        "blosc_zlib",
        "blosc_zstd",
    ])("decodes %s", async (name) => {
        const ds = await openFixture(`compression-${name}.nc`);

        expect(await ds.getVariableArray("data")).toEqual(expected);
        // Crosses a chunk boundary (chunks are 10 rows)
        expect(await ds.get("data", [slice(9, 11), slice(0, 50, 25)])).toEqual(
            new Float32Array([450 % 97, 475 % 97, 500 % 97, 525 % 97]),
        );
        await ds.close();
    });

    test("rejects data compressed with szip, which is not built in", async () => {
        const ds = await openFixture("compression-szip.nc");

        // NC_ENOFILTER
        await expect(ds.getVariableArray("data")).rejects.toThrow(
            "error: -136",
        );
        await ds.close();
    });
});
