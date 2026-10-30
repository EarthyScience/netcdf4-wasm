// Lets the browser-only WASM module run in Node: it is fetched from dist/
// and compiled once per test file instead of once per dataset.

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const wasmPath = fileURLToPath(
    new URL("../dist/netcdf4-wasm.wasm", import.meta.url),
);
if (!existsSync(wasmPath)) {
    throw new Error(
        `${wasmPath} is missing. Build it with 'npm run build:wasm' first.`,
    );
}

// WasmModuleLoader refuses to load outside a browser
Object.assign(globalThis, { window: globalThis });

// Emscripten fetches the binary from a URL; Node's fetch cannot read files
const wasmBytes = readFileSync(wasmPath);
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init) =>
    String(input instanceof Request ? input.url : input).endsWith(".wasm")
        ? Promise.resolve(
              new Response(wasmBytes, {
                  headers: { "Content-Type": "application/wasm" },
              }),
          )
        : originalFetch(input, init);

let compiled: Promise<WebAssembly.Module> | undefined;
WebAssembly.instantiateStreaming = async (_source, imports) => {
    compiled ??= WebAssembly.compile(wasmBytes);
    const module = await compiled;
    return { module, instance: await WebAssembly.instantiate(module, imports) };
};

// Drop the progress messages from bindings/pre.js and bindings/post.js
const originalLog = console.log;
console.log = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].startsWith("NetCDF4 WASM:"))
        return;
    originalLog(...args);
};
