import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: [
            {
                // The Emscripten module is only built into dist/, but the
                // sources import it as a sibling.
                find: /^\.\/netcdf4-wasm\.js$/,
                replacement: fileURLToPath(
                    new URL("./dist/netcdf4-wasm.js", import.meta.url),
                ),
            },
        ],
    },
    test: {
        environment: "node",
        include: ["tests/**/*.test.ts"],
        setupFiles: ["tests/setup.ts"],
        coverage: {
            provider: "v8",
            include: ["src/**/*.ts"],
            exclude: ["src/**/*.d.ts"],
            reporter: ["text", "lcov", "html"],
        },
    },
});
