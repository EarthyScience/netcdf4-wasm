// Creating datasets in the WASM file system and reading them back

import { describe, expect, test } from "vitest";
import { Dataset, type NetCDF4 } from "../../src/index.js";

// Each dataset gets its own WASM instance, so a written file can only be
// read back through its bytes
async function reopen(ds: NetCDF4): Promise<NetCDF4> {
    await ds.close();
    return Dataset(await ds.toArrayBuffer());
}

describe("Writing", () => {
    test("defines dimensions and variables", async () => {
        const ds = await Dataset("/tmp/define.nc", "w", { format: "NETCDF4" });
        await ds.createDimension("x", 3);
        await ds.createDimension("y", 2);
        await ds.createVariable("v", "f8", ["x", "y"]);
        await ds.createVariable("n", "i4", ["x"]);

        const read = await reopen(ds);

        expect(await read.getDims()).toMatchObject({
            x: { size: 3 },
            y: { size: 2 },
        });
        expect(await read.getVariableInfo("v")).toMatchObject({
            dtype: "f8",
            dimensions: ["x", "y"],
        });
        expect((await read.getVariableInfo("n")).dtype).toBe("i4");
        await read.close();
    });

    test("rejects invalid definitions", async () => {
        const ds = await Dataset("/tmp/invalid.nc", "w", { format: "NETCDF4" });
        await ds.createDimension("x", 3);

        await expect(ds.createDimension("x", 4)).rejects.toThrow(
            "Dimension 'x' already exists",
        );
        await expect(ds.createDimension("y", -1)).rejects.toThrow(
            "Invalid dimension size",
        );
        await expect(ds.createVariable("v", "nope", ["x"])).rejects.toThrow(
            "Unsupported datatype: nope",
        );
        await expect(ds.createVariable("v", "f8", ["z"])).rejects.toThrow(
            "Dimension 'z' not found",
        );
        await ds.close();
    });

    // HDF5 overflows Emscripten's default 64 KB stack while writing
    // ("memory access out of bounds"); linking with -sSTACK_SIZE=1MB fixes it
    test.fails("writes NETCDF4 data and reads it back", async () => {
        const ds = await Dataset("/tmp/data4.nc", "w", { format: "NETCDF4" });
        await ds.createDimension("x", 3);
        const v = await ds.createVariable("v", "f8", ["x"]);
        await v.setValue(new Float64Array([1.5, 2.5, 3.5]));

        const read = await reopen(ds);

        expect(await read.getVariableArray("v")).toEqual(
            new Float64Array([1.5, 2.5, 3.5]),
        );
    });

    // Nothing calls nc_enddef before writing data: NC_EINDEFINE (-39)
    test.fails("writes classic data and reads it back", async () => {
        const ds = await Dataset("/tmp/data3.nc", "w");
        await ds.createDimension("x", 3);
        const v = await ds.createVariable("v", "f8", ["x"]);
        await v.setValue(new Float64Array([1.5, 2.5, 3.5]));

        const read = await reopen(ds);

        expect(await read.getVariableArray("v")).toEqual(
            new Float64Array([1.5, 2.5, 3.5]),
        );
    });

    // Group.setAttr and Variable.setAttr only update an in-memory cache
    test.fails("writes attributes", async () => {
        const ds = await Dataset("/tmp/attrs.nc", "w", { format: "NETCDF4" });
        await ds.createDimension("x", 3);
        const v = await ds.createVariable("v", "f8", ["x"]);
        ds.setAttr("title", "written");
        v.units = "m";

        const read = await reopen(ds);

        expect(read.getAttr("title")).toBe("written");
        expect(read.variables.v.units).toBe("m");
    });
});
