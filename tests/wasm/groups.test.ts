// Nested groups in groups.nc: / (x) > a (y) > b, and an empty /c

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { NetCDF4 } from "../../src/index.js";
import { openFixture } from "../helpers.js";

describe("Groups", () => {
    let ds: NetCDF4;

    beforeAll(async () => {
        ds = await openFixture("groups.nc");
    });

    afterAll(async () => {
        await ds.close();
    });

    test("loads the group tree", () => {
        expect(Object.keys(ds.groups)).toEqual(["a", "c"]);
        expect(Object.keys(ds.groups.a.groups)).toEqual(["b"]);
        expect(ds.groups.a.groups.b.path).toBe("/a/b");
    });

    test("loads the attributes and variables of each group", () => {
        expect(ds.getAttr("where")).toBe("root");
        expect(ds.groups.a.getAttr("where")).toBe("a");
        expect(ds.groups.a.groups.b.getAttr("where")).toBe("b");
        expect(ds.groups.c.getAttr("where")).toBe("c");

        expect(Object.keys(ds.variables)).toEqual(["root_var"]);
        expect(Object.keys(ds.groups.a.variables)).toEqual(["a_var"]);
        expect(Object.keys(ds.groups.c.variables)).toEqual([]);
    });

    test("reads variables by group path", async () => {
        expect(await ds.getVariableArray("root_var")).toEqual(
            new Int32Array([1, 2]),
        );
        expect(await ds.getVariableArray("a_var", "/a")).toEqual(
            new Int32Array([0, 1, 2, 3, 4, 5]),
        );
        expect(await ds.getVariableArray("b_var", "/a/b")).toEqual(
            new Float64Array([0.5, 1.5, 2.5]),
        );
    });

    test("resolves dimensions defined in a parent group", async () => {
        expect(await ds.getVariableInfo("a_var", "/a")).toMatchObject({
            dimensions: ["x", "y"],
            shape: [2, 3],
        });
        expect(await ds.getVariableInfo("b_var", "/a/b")).toMatchObject({
            dimensions: ["y"],
            shape: [3],
        });
    });

    test("returns the complete hierarchy", async () => {
        const root = await ds.getCompleteHierarchy();

        expect(root).toMatchObject({
            path: "/",
            dimensions: { x: { size: 2 } },
            attributes: { where: "root" },
        });
        expect(Object.keys(root.variables)).toEqual(["root_var"]);
        expect(root.groups.a.groups.b).toMatchObject({
            path: "/a/b",
            attributes: { where: "b" },
            groups: {},
        });
        expect(Object.keys(root.groups.a.groups.b.variables)).toEqual([
            "b_var",
        ]);
    });

    test("rejects an unknown group", async () => {
        await expect(ds.getVariableArray("a_var", "/nope")).rejects.toThrow(
            "Failed to find group '/nope'",
        );
    });
});
