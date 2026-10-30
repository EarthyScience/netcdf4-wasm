import { readFileSync } from "node:fs";
import { Dataset, type NetCDF4 } from "../src/index.js";

// A copy, so the bytes start at offset 0 of their own ArrayBuffer
export function fixtureBytes(name: string): Uint8Array<ArrayBuffer> {
    return new Uint8Array(
        readFileSync(new URL(`./fixtures/${name}`, import.meta.url)),
    );
}

export function openFixture(name: string): Promise<NetCDF4> {
    return Dataset(fixtureBytes(name));
}
