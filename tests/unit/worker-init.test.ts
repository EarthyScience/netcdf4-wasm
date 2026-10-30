// Worker initialization tests: init failures must reject instead of hanging

import { getEventListeners } from "node:events";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { NetCDF4 } from "../../src/index.js";

// Minimal stand-in for the browser Worker. Answers 'init' with
// FakeWorker.initReply (reply data, or an event dispatched as is)
// and every other request with success.
class FakeWorker extends EventTarget {
    static currentWorker: FakeWorker;
    static initReply: Record<string, unknown> | Event;

    constructor() {
        super();
        FakeWorker.currentWorker = this;
    }

    postMessage({ type, id }: { type: string; id: number }) {
        const reply =
            type === "init"
                ? FakeWorker.initReply
                : { success: true, result: 1 };
        queueMicrotask(() =>
            this.dispatchEvent(
                reply instanceof Event
                    ? reply
                    : new MessageEvent("message", { data: { id, ...reply } }),
            ),
        );
    }

    terminate() {}
}

function expectNoInitListeners() {
    expect(getEventListeners(FakeWorker.currentWorker, "message")).toHaveLength(
        0,
    );
    expect(getEventListeners(FakeWorker.currentWorker, "error")).toHaveLength(
        0,
    );
}

describe("Worker Initialization", () => {
    describe("Main Thread (setupWorker)", () => {
        beforeAll(() => {
            Object.assign(globalThis, { Worker: FakeWorker });
        });

        test("should open dataset when worker reports success", async () => {
            FakeWorker.initReply = { success: true };

            const dataset = await NetCDF4.fromBlobLazy(new Blob([]));

            expect(dataset.isopen).toBe(true);
            expectNoInitListeners();

            await dataset.close();
        });

        test("should reject with the error sent by the worker", async () => {
            FakeWorker.initReply = {
                success: false,
                error: "wasm fetch failed",
            };

            await expect(NetCDF4.fromBlobLazy(new Blob([]))).rejects.toThrow(
                "wasm fetch failed",
            );
            expectNoInitListeners();
        });

        test("should reject when worker script fails to load", async () => {
            FakeWorker.initReply = Object.assign(new Event("error"), {
                message: "Script error",
            });

            await expect(NetCDF4.fromBlobLazy(new Blob([]))).rejects.toThrow(
                "Worker failed to start: Script error",
            );
            expectNoInitListeners();
        });

        test("should use fallback message when error event has none", async () => {
            FakeWorker.initReply = new Event("error");

            await expect(NetCDF4.fromBlobLazy(new Blob([]))).rejects.toThrow(
                "Worker failed to start: unknown error",
            );
            expectNoInitListeners();
        });
    });

    describe("Worker Script (netcdf-worker)", () => {
        const originalSelf = globalThis.self;

        afterAll(() => {
            if (originalSelf) globalThis.self = originalSelf;
            else Reflect.deleteProperty(globalThis, "self");
        });

        // netcdf-worker binds onmessage to `self` once, at import time. A second
        // test here would need vi.resetModules() and a fresh import.
        test("should report a failed WASM load instead of hanging", async () => {
            vi.doMock("../../dist/netcdf4-wasm.js", () => ({
                default: () =>
                    Promise.reject(new Error("netcdf4-wasm.wasm: HTTP 404")),
            }));
            const scope = {
                postMessage: vi.fn(),
                onmessage: async (_: MessageEvent) => {},
            };
            Object.assign(globalThis, { self: scope });
            const consoleError = vi
                .spyOn(console, "error")
                .mockImplementation(() => {});

            try {
                await import("../../src/netcdf-worker.js");
                await scope.onmessage(
                    new MessageEvent("message", {
                        data: { type: "init", id: 1 },
                    }),
                );

                expect(scope.postMessage).toHaveBeenCalledWith({
                    id: 1,
                    success: false,
                    error: expect.stringContaining("netcdf4-wasm"),
                });
            } finally {
                consoleError.mockRestore();
            }
        });
    });
});
