
//
// netCDF-C reads files through synchronous POSIX calls, so every read has to
// be answered synchronously. Synchronous XHR is only allowed in Web Workers,
// which is why remote files are only supported on the worker path.

import type { RemoteFileOptions } from './types.js';

const DEFAULT_BLOCK_SIZE = 1024 * 1024;       // 1 MiB
const DEFAULT_CACHE_SIZE = 64 * 1024 * 1024;  // 64 MiB

// Emscripten errno values
const EIO = 29;

/** Apply defaults to the cache settings and validate them. */
export function cacheSizes(options: Pick<RemoteFileOptions, 'blockSize' | 'cacheSize'> = {}): { blockSize: number; cacheSize: number } {
    const blockSize = options.blockSize ?? DEFAULT_BLOCK_SIZE;
    const cacheSize = options.cacheSize ?? DEFAULT_CACHE_SIZE;
    if (!Number.isSafeInteger(blockSize) || blockSize <= 0) {
        throw new Error(`blockSize must be a positive integer, got ${blockSize}`);
    }
    if (!Number.isSafeInteger(cacheSize) || cacheSize < blockSize) {
        throw new Error(`cacheSize must be an integer no smaller than blockSize (${blockSize}), got ${cacheSize}`);
    }
    return { blockSize, cacheSize };
}

/**
 * With maxFullDownload set, fail before any data is downloaded if the server
 * ignores Range requests and the whole file is larger than the limit.
 * A synchronous XHR would download the whole body before we could look at the
 * status, so this probe uses fetch and cancels the body after the headers.
 */
export async function checkRangeSupport(url: string, options: RemoteFileOptions = {}): Promise<void> {
    const { maxFullDownload } = options;
    if (maxFullDownload === undefined) return;
    if (!Number.isSafeInteger(maxFullDownload) || maxFullDownload < 0) {
        throw new Error(`maxFullDownload must be a non-negative integer, got ${maxFullDownload}`);
    }

    let response: Response;
    try {
        response = await fetch(url, {
            headers: { ...options.headers, Range: 'bytes=0-0' },
            credentials: options.withCredentials ? 'include' : 'same-origin',
        });
    } catch (err: any) {
        throw new Error(`Request to ${url} failed (network error or blocked by CORS): ${err?.message ?? err}`);
    }
    await response.body?.cancel();

    if (response.status === 206) return;
    if (response.status !== 200) {
        throw new Error(`Request to ${url} failed: HTTP ${response.status} ${response.statusText}`);
    }
    // Range was ignored. Without a Content-Length the size is unknown, so the limit can't be met.
    const header = response.headers.get('Content-Length');
    const length = header === null ? NaN : Number(header);
    if (!(length <= maxFullDownload)) {
        const size = Number.isNaN(length) ? 'of unknown size' : `${length} bytes`;
        throw new Error(`${url} does not support range requests, and the whole file (${size}) exceeds maxFullDownload (${maxFullDownload} bytes)`);
    }
}

/** A random-access byte source with a known length. */
export interface RangeSource {
    readonly length: number;
    /** Return the bytes in [start, end). */
    read(start: number, end: number): Uint8Array;
}

/** RangeSource backed by synchronous XMLHttpRequest Range requests. */
export class XhrRangeSource implements RangeSource {
    readonly length: number;
    // Set when the server ignores Range and sends the whole file
    private full?: Uint8Array;

    constructor(
        private url: string,
        private options: Pick<RemoteFileOptions, 'headers' | 'withCredentials'> = {}
    ) {
        this.length = this.probeLength();
    }

    read(start: number, end: number): Uint8Array {
        if (this.full) return this.full.subarray(start, end);

        const xhr = this.request('GET', `bytes=${start}-${end - 1}`);
        const body = new Uint8Array(xhr.response as ArrayBuffer);
        if (xhr.status === 200) {
            // Range was ignored: keep the whole file instead of refetching it on every read
            this.full = body;
            return body.subarray(start, end);
        }
        if (body.length !== end - start) {
            throw new Error(`Short read from ${this.url}: expected ${end - start} bytes at offset ${start}, got ${body.length}`);
        }
        return body;
    }

    private probeLength(): number {
        // HEAD first: Content-Length is readable cross-origin without extra CORS headers
        let head: XMLHttpRequest | undefined;
        try {
            head = this.request('HEAD');
        } catch {
            // Some servers (e.g. presigned URLs) reject HEAD; fall through to a ranged GET
        }
        if (head) {
            const length = Number(head.getResponseHeader('Content-Length'));
            if (length > 0) return length;
        }

        const xhr = this.request('GET', 'bytes=0-0');
        if (xhr.status === 200) {
            this.full = new Uint8Array(xhr.response as ArrayBuffer);
            return this.full.length;
        }
        const total = /\/(\d+)\s*$/.exec(xhr.getResponseHeader('Content-Range') ?? '');
        if (!total) {
            throw new Error(`Could not determine the size of ${this.url}: no Content-Length or Content-Range header (cross-origin servers must expose one via Access-Control-Expose-Headers)`);
        }
        return Number(total[1]);
    }

    private request(method: 'HEAD' | 'GET', range?: string): XMLHttpRequest {
        const xhr = new XMLHttpRequest();
        xhr.open(method, this.url, false);
        // Allowed for synchronous requests in workers (only Window contexts forbid it)
        xhr.responseType = 'arraybuffer';
        xhr.withCredentials = !!this.options.withCredentials;
        for (const [name, value] of Object.entries(this.options.headers ?? {})) {
            xhr.setRequestHeader(name, value);
        }
        if (range) xhr.setRequestHeader('Range', range);

        try {
            xhr.send(null);
        } catch (err: any) {
            throw new Error(`Request to ${this.url} failed (network error or blocked by CORS): ${err?.message ?? err}`);
        }
        if (xhr.status !== 200 && xhr.status !== 206) {
            throw new Error(`Request to ${this.url} failed: HTTP ${xhr.status} ${xhr.statusText}`);
        }
        return xhr;
    }
}

/**
 * Block cache in front of a RangeSource. Misses on adjacent blocks are fetched
 * with a single request, and least recently used blocks are evicted once the
 * cache exceeds cacheSize.
 */
export class RemoteFile {
    readonly blockSize: number;
    readonly cacheSize: number;
    /** The last error raised by a read, kept so the worker can report it. */
    lastError?: Error;

    // Map iteration order doubles as LRU order: oldest first
    private blocks = new Map<number, Uint8Array>();
    private cachedBytes = 0;

    constructor(private source: RangeSource, options: RemoteFileOptions = {}) {
        ({ blockSize: this.blockSize, cacheSize: this.cacheSize } = cacheSizes(options));
    }

    get length(): number {
        return this.source.length;
    }

    /** Fill target with bytes starting at position. Returns the number of bytes read. */
    read(target: Uint8Array, position: number): number {
        const end = Math.min(position + target.length, this.length);
        if (position >= end) return 0;

        const bs = this.blockSize;
        const first = Math.floor(position / bs);
        const last = Math.floor((end - 1) / bs);

        let block = first;
        while (block <= last) {
            let data = this.getBlock(block);
            let runEnd = block;
            if (!data) {
                while (runEnd < last && !this.blocks.has(runEnd + 1)) runEnd++;
                data = this.fetchRun(block, runEnd);
            }
            // data covers blocks [block, runEnd]; copy the part overlapping the request
            const dataStart = block * bs;
            const from = Math.max(position, dataStart);
            const to = Math.min(end, dataStart + data.length);
            target.set(data.subarray(from - dataStart, to - dataStart), from - position);
            block = runEnd + 1;
        }
        return end - position;
    }

    private fetchRun(first: number, last: number): Uint8Array {
        const bs = this.blockSize;
        const data = this.source.read(first * bs, Math.min((last + 1) * bs, this.length));
        // Large bulk reads would flush the whole cache, including the metadata blocks
        // that are reused on every access, so only cache runs that fit comfortably
        if (data.length <= Math.max(this.cacheSize / 4, bs)) {
            for (let block = first; block <= last; block++) {
                const offset = (block - first) * bs;
                this.putBlock(block, data.slice(offset, offset + bs));
            }
        }
        return data;
    }

    private getBlock(block: number): Uint8Array | undefined {
        const data = this.blocks.get(block);
        if (data) {
            this.blocks.delete(block);
            this.blocks.set(block, data);
        }
        return data;
    }

    private putBlock(block: number, data: Uint8Array): void {
        this.blocks.set(block, data);
        this.cachedBytes += data.length;
        for (const [oldest, old] of this.blocks) {
            if (this.cachedBytes <= this.cacheSize) break;
            this.blocks.delete(oldest);
            this.cachedBytes -= old.length;
        }
    }
}

/**
 * Create a read-only file at path in the Emscripten FS whose reads are served
 * by file. Network errors surface to netCDF-C as EIO; the underlying error is
 * kept in file.lastError.
 */
export function createRemoteFileNode(FS: any, path: string, file: RemoteFile): any {
    const slash = path.lastIndexOf('/');
    const dir = path.slice(0, slash) || '/';
    FS.mkdirTree(dir);

    const node = FS.createFile(dir, path.slice(slash + 1), {}, true, false);
    // MEMFS reports usedBytes as the file size (stat, SEEK_END)
    Object.defineProperty(node, 'usedBytes', { get: () => file.length });
    node.stream_ops = {
        ...node.stream_ops,
        read(_stream: any, buffer: Int8Array, offset: number, length: number, position: number): number {
            // buffer is HEAP8; read through a byte view so the copy is a plain memcpy
            const target = new Uint8Array(buffer.buffer, buffer.byteOffset + offset, length);
            try {
                return file.read(target, position);
            } catch (err: any) {
                file.lastError = err instanceof Error ? err : new Error(String(err));
                throw new FS.ErrnoError(EIO);
            }
        },
    };
    return node;
}
