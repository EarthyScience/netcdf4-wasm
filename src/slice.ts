/**
 * Represents selecting the entire dimension.
 */
export interface All {
    readonly type: "all";
}

/** Canonical full-dimension selector */
export function all(): All {
    return { type: "all" };
}

export function isAll(v: unknown): v is All {
    return typeof v === "object" && v !== null && (v as any).type === "all";
}

/**
 * Represents a dimension slice.
 * Undefined fields are resolved against the actual dimension size at read time.
 */
export class Slice {
    constructor(
        public readonly start?: number,
        public readonly stop?: number,
        public readonly step?: number
    ) {}
}

/**
 * slice(stop)
 * slice(start, stop)
 * slice(start, stop, step)
 */
export function slice(stop: number): Slice;
export function slice(start: number, stop: number): Slice;
export function slice(start: number, stop: number, step: number): Slice;
export function slice(
    startOrStop: number,
    stop?: number,
    step?: number
): Slice {
    if (stop === undefined) {
        return new Slice(undefined, startOrStop, undefined);
    }
    return new Slice(startOrStop, stop, step);
}

/**
 * A single dimension selection:
 *  - all()  → full dimension
 *  - "all"  → full dimension (compat)
 *  - null   → full dimension (compat)
 *  - number → scalar index
 *  - Slice  → range selection
 */
export type DimSelection = All | "all" | null | number | Slice;

/**
 * Resolved, concrete read parameters for one dimension after applying a
 * DimSelection against a known dimension size.
 */
export interface ResolvedDim {
    /** Start index in the NetCDF dimension */
    start: number;

    /** Number of elements to read from NetCDF (contiguous span, always >= 0) */
    count: number;

    /** Step. Always positive. Never 0. */
    step: number;

    /** True when the selection was a scalar index — dimension is collapsed */
    collapsed: boolean;
}

/**
 * Resolve a DimSelection against a concrete dimension size.
 * Accepts BigInt dimension sizes (from nc_inq_dimlen i64 reads) and coerces safely.
 * Step is always treated as positive; start/stop are swapped if out of order.
 */
export function resolveDim(sel: DimSelection, dimSizeRaw: number | bigint): ResolvedDim {

    const dimSize = Number(dimSizeRaw);

    // full dimension
    if (sel === null || sel === "all" || isAll(sel)) {
        return { start: 0, count: dimSize, step: 1, collapsed: false };
    }

    // scalar index
    if (typeof sel === "number") {
        const idx     = sel < 0 ? dimSize + sel : sel;
        const clamped = Math.max(0, Math.min(idx, dimSize - 1));
        return { start: clamped, count: 1, step: 1, collapsed: true };
    }

    // Slice — step is always positive
    const step = sel.step ?? 1;
    if (step <= 0) throw new Error("Slice step must be a positive integer");

    const rawStart = sel.start ?? 0;
    const rawStop  = sel.stop  ?? dimSize;

    const start = Math.max(
        0,
        Math.min(rawStart < 0 ? dimSize + rawStart : rawStart, dimSize)
    );

    const stop = Math.max(
        0,
        Math.min(rawStop < 0 ? dimSize + rawStop : rawStop, dimSize)
    );

    // Swap if caller passed start > stop — resolve to the correct forward range
    const lo = Math.min(start, stop);
    const hi = Math.max(start, stop);

    const span  = hi - lo;
    const count = span === 0 ? 0 : Math.ceil(span / step);
    return { start: lo, count, step, collapsed: false };
}