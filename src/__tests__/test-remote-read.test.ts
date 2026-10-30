// Remote reads: range requests, the block cache, and the Emscripten FS node

import { jest } from "@jest/globals";
import {
    cacheSizes,
    checkRangeSupport,
    createRemoteFileNode,
    RemoteFile,
    XhrRangeSource,
} from "../remote-read.js";

const GiB = 1024 ** 3;
const URL_ = "https://example.org/data.nc";

// Deterministic file contents, so offsets above 4 GiB need no allocation
const bytesAt = (start: number, end: number) =>
    Uint8Array.from({ length: end - start }, (_, i) => (start + i) % 251);

type Reply =
    | { status: number; body?: Uint8Array; headers?: Record<string, string> }
    | "network-error";
type Handler = (method: string, headers: Record<string, string>) => Reply;

// Synchronous XMLHttpRequest stand-in answered by FakeXhr.handler
class FakeXhr {
    static handler: Handler;
    static requests: {
        method: string;
        url: string;
        headers: Record<string, string>;
        withCredentials: boolean;
    }[];

    responseType = "";
    withCredentials = false;
    status = 0;
    statusText = "";
    response: ArrayBuffer | null = null;
    private method = "";
    private url = "";
    private headers: Record<string, string> = {};
    private replyHeaders: Record<string, string> = {};

    open(method: string, url: string, async: boolean) {
        expect(async).toBe(false);
        this.method = method;
        this.url = url;
    }

    setRequestHeader(name: string, value: string) {
        this.headers[name] = value;
    }

    send() {
        FakeXhr.requests.push({
            method: this.method,
            url: this.url,
            headers: this.headers,
            withCredentials: this.withCredentials,
        });
        const reply = FakeXhr.handler(this.method, this.headers);
        if (reply === "network-error")
            throw new DOMException("Failed to load", "NetworkError");
        this.status = reply.status;
        this.statusText = reply.status === 404 ? "Not Found" : "";
        this.response = (reply.body ?? new Uint8Array()).slice().buffer;
        this.replyHeaders = Object.fromEntries(
            Object.entries(reply.headers ?? {}).map(([k, v]) => [
                k.toLowerCase(),
                v,
            ]),
        );
    }

    getResponseHeader(name: string) {
        return this.replyHeaders[name.toLowerCase()] ?? null;
    }
}

// A server for a file of the given size with configurable Range/CORS behavior
function serve(
    size: number,
    { head = true, exposeRange = true, ignoreRange = false } = {},
): Handler {
    return (method, headers) => {
        if (method === "HEAD") {
            return head
                ? { status: 200, headers: { "Content-Length": String(size) } }
                : { status: 405 };
        }
        const match = /^bytes=(\d+)-(\d+)$/.exec(headers.Range ?? "");
        if (!match || ignoreRange)
            return { status: 200, body: bytesAt(0, size) };
        const start = Number(match[1]);
        const end = Math.min(Number(match[2]) + 1, size);
        return {
            status: 206,
            body: bytesAt(start, end),
            headers: exposeRange
                ? { "Content-Range": `bytes ${start}-${end - 1}/${size}` }
                : {},
        };
    };
}

describe("XhrRangeSource", () => {
    const originalXhr = globalThis.XMLHttpRequest;

    beforeEach(() => {
        FakeXhr.requests = [];
        Object.assign(globalThis, { XMLHttpRequest: FakeXhr });
    });

    afterEach(() => {
        Object.assign(globalThis, { XMLHttpRequest: originalXhr });
    });

    test("probes the size with HEAD and reads a range at a 300 GiB offset", () => {
        const size = 300 * GiB;
        FakeXhr.handler = serve(size);
        const source = new XhrRangeSource(URL_, {
            headers: { Authorization: "Bearer token" },
            withCredentials: true,
        });

        expect(source.length).toBe(size);
        expect(source.read(size - 16, size)).toEqual(bytesAt(size - 16, size));
        expect(FakeXhr.requests.map((r) => r.method)).toEqual(["HEAD", "GET"]);
        expect(FakeXhr.requests[1].headers).toEqual({
            Authorization: "Bearer token",
            Range: `bytes=${size - 16}-${size - 1}`,
        });
        expect(
            FakeXhr.requests.every((r) => r.url === URL_ && r.withCredentials),
        ).toBe(true);
    });

    test("falls back to a ranged GET when HEAD is rejected", () => {
        FakeXhr.handler = serve(1000, { head: false });
        expect(new XhrRangeSource(URL_).length).toBe(1000);
        expect(FakeXhr.requests[1].headers.Range).toBe("bytes=0-0");
    });

    test("explains when the size cannot be determined", () => {
        FakeXhr.handler = serve(1000, { head: false, exposeRange: false });
        expect(() => new XhrRangeSource(URL_)).toThrow(
            "Access-Control-Expose-Headers",
        );
    });

    test("reads without Content-Range when the server does not expose it", () => {
        FakeXhr.handler = serve(1000, { exposeRange: false });
        expect(new XhrRangeSource(URL_).read(100, 200)).toEqual(
            bytesAt(100, 200),
        );
    });

    test("keeps the whole file when the server ignores Range", () => {
        FakeXhr.handler = serve(1000, { ignoreRange: true });
        const source = new XhrRangeSource(URL_);
        expect(source.read(10, 20)).toEqual(bytesAt(10, 20));
        expect(source.read(900, 1000)).toEqual(bytesAt(900, 1000));
        expect(FakeXhr.requests.map((r) => r.method)).toEqual(["HEAD", "GET"]);
    });

    test("rejects short bodies", () => {
        FakeXhr.handler = serve(1000);
        const source = new XhrRangeSource(URL_);

        FakeXhr.handler = () => ({ status: 206, body: bytesAt(100, 105) });
        expect(() => source.read(100, 110)).toThrow("Short read");
    });

    test("reports HTTP and network errors with the URL", () => {
        FakeXhr.handler = () => ({ status: 404 });
        expect(() => new XhrRangeSource(URL_)).toThrow(
            `Request to ${URL_} failed: HTTP 404 Not Found`,
        );

        FakeXhr.handler = () => "network-error";
        expect(() => new XhrRangeSource(URL_)).toThrow(
            "network error or blocked by CORS",
        );
    });
});

describe("RemoteFile", () => {
    function source(length: number) {
        return { length, read: jest.fn(bytesAt) };
    }

    test("reads across block boundaries above 4 GiB with one request", () => {
        const length = 300 * GiB;
        const bytes = source(length);
        const file = new RemoteFile(bytes, { blockSize: 16, cacheSize: 256 });
        const target = new Uint8Array(20);

        expect(file.read(target, length - 23)).toBe(20);
        expect(target).toEqual(bytesAt(length - 23, length - 3));
        expect(bytes.read.mock.calls).toEqual([[length - 32, length]]);
    });

    test("only fetches the blocks that are missing", () => {
        const bytes = source(1000);
        const file = new RemoteFile(bytes, { blockSize: 16, cacheSize: 256 });

        file.read(new Uint8Array(1), 16);
        const target = new Uint8Array(64);
        file.read(target, 0);

        expect(target).toEqual(bytesAt(0, 64));
        expect(bytes.read.mock.calls).toEqual([
            [16, 32],
            [0, 16],
            [32, 64],
        ]);
    });

    test("evicts the least recently used block", () => {
        const bytes = source(1000);
        const file = new RemoteFile(bytes, { blockSize: 16, cacheSize: 32 });

        for (const position of [0, 16, 0, 32, 0, 32])
            file.read(new Uint8Array(1), position);
        expect(bytes.read).toHaveBeenCalledTimes(3);
        file.read(new Uint8Array(1), 16);
        expect(bytes.read).toHaveBeenCalledTimes(4);
    });

    test("does not let bulk reads flush the cache", () => {
        const bytes = source(1000);
        const file = new RemoteFile(bytes, { blockSize: 16, cacheSize: 64 });

        file.read(new Uint8Array(1), 0);
        file.read(new Uint8Array(64), 16);
        file.read(new Uint8Array(1), 0);
        expect(bytes.read).toHaveBeenCalledTimes(2);
        file.read(new Uint8Array(1), 16);
        expect(bytes.read).toHaveBeenCalledTimes(3);
    });

    test("handles the short final block and EOF", () => {
        const bytes = source(19);
        const file = new RemoteFile(bytes, { blockSize: 16, cacheSize: 32 });

        expect(file.read(new Uint8Array(10), 17)).toBe(2);
        expect(bytes.read).toHaveBeenCalledWith(16, 19);
        expect(file.read(new Uint8Array(1), 19)).toBe(0);
        expect(file.read(new Uint8Array(1), 100)).toBe(0);
    });

    test("validates cache settings", () => {
        expect(cacheSizes()).toEqual({
            blockSize: 1024 * 1024,
            cacheSize: 64 * 1024 * 1024,
        });
        expect(() => cacheSizes({ blockSize: 0 })).toThrow("blockSize");
        expect(() => cacheSizes({ blockSize: 1.5 })).toThrow("blockSize");
        expect(() => cacheSizes({ blockSize: 16, cacheSize: 8 })).toThrow(
            "cacheSize",
        );
        expect(() => new RemoteFile(source(10), { blockSize: -1 })).toThrow(
            "blockSize",
        );
    });
});

describe("checkRangeSupport", () => {
    const originalFetch = globalThis.fetch;
    let fetchMock: jest.Mock<typeof fetch>;

    function reply(status: number, headers: Record<string, string> = {}) {
        fetchMock.mockResolvedValue(
            new Response(status === 206 ? "x" : "whole file", {
                status,
                headers,
            }),
        );
    }

    beforeEach(() => {
        fetchMock = jest.fn<typeof fetch>();
        Object.assign(globalThis, { fetch: fetchMock });
    });

    afterEach(() => {
        Object.assign(globalThis, { fetch: originalFetch });
    });

    test("sends nothing without maxFullDownload", async () => {
        await checkRangeSupport(URL_);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    test("validates maxFullDownload", async () => {
        await expect(
            checkRangeSupport(URL_, { maxFullDownload: -1 }),
        ).rejects.toThrow("maxFullDownload must be a non-negative integer");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    test("passes when the server honors Range", async () => {
        reply(206);
        await checkRangeSupport(URL_, {
            maxFullDownload: 0,
            headers: { Authorization: "Bearer token" },
            withCredentials: true,
        });
        expect(fetchMock).toHaveBeenCalledWith(URL_, {
            headers: { Authorization: "Bearer token", Range: "bytes=0-0" },
            credentials: "include",
        });
    });

    test("allows a full download up to maxFullDownload", async () => {
        reply(200, { "Content-Length": "1000" });
        await expect(
            checkRangeSupport(URL_, { maxFullDownload: 1000 }),
        ).resolves.toBeUndefined();
    });

    test("rejects a full download above maxFullDownload or of unknown size", async () => {
        reply(200, { "Content-Length": "1001" });
        await expect(
            checkRangeSupport(URL_, { maxFullDownload: 1000 }),
        ).rejects.toThrow(
            "the whole file (1001 bytes) exceeds maxFullDownload (1000 bytes)",
        );

        reply(200);
        await expect(
            checkRangeSupport(URL_, { maxFullDownload: 1000 }),
        ).rejects.toThrow("of unknown size");
    });

    test("reports HTTP and network errors", async () => {
        reply(403);
        await expect(
            checkRangeSupport(URL_, { maxFullDownload: 0 }),
        ).rejects.toThrow("HTTP 403");

        fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
        await expect(
            checkRangeSupport(URL_, { maxFullDownload: 0 }),
        ).rejects.toThrow("network error or blocked by CORS");
    });
});

describe("createRemoteFileNode", () => {
    test("exposes the size, serves reads, and maps errors to errno", () => {
        const length = 300 * GiB;
        const bytes = { length, read: jest.fn(bytesAt) };
        const file = new RemoteFile(bytes, { blockSize: 16, cacheSize: 32 });
        const FS = {
            mkdirTree: jest.fn(),
            createFile: jest.fn(() => ({ stream_ops: {} })),
            ErrnoError: class extends Error {
                constructor(public errno: number) {
                    super(String(errno));
                }
            },
        };

        const node = createRemoteFileNode(FS, "/remote/data.nc", file);
        expect(FS.mkdirTree).toHaveBeenCalledWith("/remote");
        expect(node.usedBytes).toBe(length);

        const heap = new Int8Array(10);
        expect(node.stream_ops.read({}, heap, 2, 3, length - 3)).toBe(3);
        expect(new Uint8Array(heap.buffer, 2, 3)).toEqual(
            bytesAt(length - 3, length),
        );

        bytes.read.mockImplementationOnce(() => {
            throw new Error("HTTP 403");
        });
        expect(() => node.stream_ops.read({}, heap, 0, 1, 0)).toThrow("29");
        expect(file.lastError?.message).toBe("HTTP 403");
    });
});
