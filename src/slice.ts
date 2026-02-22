/**
 * Represents a dimension slice.
 * Null fields are resolved against the actual dimension size at read time.
 */
export class Slice {
    constructor(
        public readonly start: number | null,
        public readonly stop:  number | null,
        public readonly step:  number | null
    ) {}
}

/**
 * slice(stop)
 * slice(start, stop)
 * slice(start, stop, step)
 * slice(null) — equivalent to null (all elements)
 */
export function slice(stop: number | null): Slice;
export function slice(start: number | null, stop: number | null): Slice;
export function slice(start: number | null, stop: number | null, step: number | null): Slice;
export function slice(
    startOrStop: number | null,
    stop?: number | null,
    step?: number | null
): Slice {
    if (stop === undefined) {
        return new Slice(null, startOrStop, null);
    }
    return new Slice(startOrStop, stop ?? null, step ?? null);
}

/** A single dimension selection: null = all, number = scalar index, Slice = range */
export type DimSelection = null | number | Slice;

/**
 * Resolved, concrete read parameters for one dimension after applying a
 * DimSelection against a known dimension size.
 */
export interface ResolvedDim {
    /** Start index in the NetCDF dimension (always the lower bound, even for negative step) */
    start: number;
    /** Number of elements to read from NetCDF (contiguous span, always positive) */
    count: number;
    /** Step. Positive = forward, negative = reversed output. Never 0. */
    step: number;
    /** True when the selection was a scalar index — dimension is collapsed */
    collapsed: boolean;
}

/**
 * Resolve a DimSelection against a concrete dimension size.
 * Accepts BigInt dimension sizes (from nc_inq_dimlen i64 reads) and coerces safely.
 */
export function resolveDim(sel: DimSelection, dimSizeRaw: number | bigint): ResolvedDim {
    // Coerce up front — nc_inq_dimlen returns i64 so dimSize may arrive as BigInt
    const dimSize = Number(dimSizeRaw);

    // null or empty Slice → full dimension
    if (
        sel === null ||
        (sel instanceof Slice && sel.start === null && sel.stop === null && sel.step === null)
    ) {
        return { start: 0, count: dimSize, step: 1, collapsed: false };
    }

    // Scalar index → collapsed dimension
    if (typeof sel === "number") {
        const idx     = sel < 0 ? dimSize + sel : sel;
        const clamped = Math.max(0, Math.min(idx, dimSize - 1));
        return { start: clamped, count: 1, step: 1, collapsed: true };
    }

    // Slice
    const step = sel.step ?? 1;
    if (step === 0) throw new Error("Slice step cannot be zero");

    if (step > 0) {
        const rawStart = sel.start ?? 0;
        const rawStop  = sel.stop  ?? dimSize;
        const start    = Math.max(0, Math.min(rawStart < 0 ? dimSize + rawStart : rawStart, dimSize));
        const stop     = Math.max(0, Math.min(rawStop  < 0 ? dimSize + rawStop  : rawStop,  dimSize));
        const count    = Math.max(0, stop - start);
        return { start, count, step, collapsed: false };
    } else {
        // Negative step: read [stop+1 .. start] forward from NetCDF, reverse client-side
        const rawStart = sel.start ?? dimSize - 1;
        const rawStop  = sel.stop  ?? -1;
        const start    = Math.max(0,  Math.min(rawStart < 0 ? dimSize + rawStart : rawStart, dimSize - 1));
        const stop     = Math.max(-1, Math.min(rawStop  < 0 ? dimSize + rawStop  : rawStop,  dimSize - 1));
        const count    = Math.max(0, start - stop);
        return { start: stop + 1, count, step, collapsed: false };
    }
}