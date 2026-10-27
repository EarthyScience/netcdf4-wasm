// Worker initialization tests: init failures must reject instead of hanging

import { jest } from '@jest/globals';
import { getEventListeners } from 'node:events';
import { NetCDF4 } from '../index.js';

// Minimal stand-in for the browser Worker. Answers 'init' with
// FakeWorker.initEvent and every other request with success.
class FakeWorker extends EventTarget {
    static currentWorker: FakeWorker;
    static initEvent: Event;

    constructor() {
        super();
        FakeWorker.currentWorker = this;
    }

    postMessage({ type, id }: { type: string; id?: number }) {
        queueMicrotask(() => this.dispatchEvent(type === 'init'
            ? FakeWorker.initEvent
            : new MessageEvent('message', { data: { id, success: true, result: 1 } })));
    }
}

function expectNoInitListeners() {
    expect(getEventListeners(FakeWorker.currentWorker, 'message')).toHaveLength(0);
    expect(getEventListeners(FakeWorker.currentWorker, 'error')).toHaveLength(0);
}

describe('Worker Initialization', () => {
    describe('Main Thread (setupWorker)', () => {
        beforeAll(() => {
            Object.assign(globalThis, { Worker: FakeWorker });
        });

        test('should open dataset when worker reports success', async () => {
            FakeWorker.initEvent = new MessageEvent('message', { data: { success: true } });

            const dataset = await NetCDF4.fromBlobLazy(new Blob([]));

            expect(dataset.isopen).toBe(true);
            expectNoInitListeners();

            await dataset.close();
        });

        test('should reject with the error sent by the worker', async () => {
            FakeWorker.initEvent = new MessageEvent('message', {
                data: { success: false, error: 'wasm fetch failed' },
            });

            await expect(NetCDF4.fromBlobLazy(new Blob([]))).rejects.toThrow('wasm fetch failed');
            expectNoInitListeners();
        });

        test('should reject when worker script fails to load', async () => {
            FakeWorker.initEvent = Object.assign(new Event('error'), { message: 'Script error' });

            await expect(NetCDF4.fromBlobLazy(new Blob([]))).rejects.toThrow('Worker failed to start: Script error');
            expectNoInitListeners();
        });

        test('should use fallback message when error event has none', async () => {
            FakeWorker.initEvent = new Event('error');

            await expect(NetCDF4.fromBlobLazy(new Blob([]))).rejects.toThrow('Worker failed to start: unknown error');
            expectNoInitListeners();
        });
    });

    describe('Worker Script (netcdf-worker)', () => {
        const originalSelf = globalThis.self;

        afterAll(() => {
            if (originalSelf) globalThis.self = originalSelf;
            else Reflect.deleteProperty(globalThis, 'self');
        });

        // netcdf-worker binds onmessage to `self` once, at import time. A second
        // test here would need jest.resetModules() and a fresh import.
        test('should report a missing WASM module instead of hanging', async () => {
            // The generated WASM module lives in dist, so importing it from src fails.
            const scope = { postMessage: jest.fn(), onmessage: async (_: MessageEvent) => {} };
            Object.assign(globalThis, { self: scope });
            const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

            try {
                await import('../netcdf-worker.js');
                await scope.onmessage(new MessageEvent('message', { data: { type: 'init', id: 1 } }));

                expect(scope.postMessage).toHaveBeenCalledWith({
                    id: 1, success: false, error: expect.stringContaining('netcdf4-wasm'),
                });
            } finally {
                consoleError.mockRestore();
            }
        });
    });
});
