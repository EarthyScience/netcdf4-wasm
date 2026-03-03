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
 *  - null   → full dimension (compat; matches older docs/examples)
 *  - number → scalar index
 *  - Slice  → range selection
 */
export type DimSelection = All | "all" | null | number | Slice;

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

    // Slice
    const step = sel.step ?? 1;
    if (step === 0) throw new Error("Slice step cannot be zero");

    if (step > 0) {

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

        const span  = Math.max(0, stop - start);
        const count = span === 0 ? 0 : Math.ceil(span / step);
        return { start, count, step, collapsed: false };

    } else {

        const rawStart = sel.start ?? dimSize - 1;
        // For negative step, Python's default stop is -1 (exclusive, "before index 0"),
        // but only when stop is omitted. If the user explicitly passes -1, it should
        // be treated as an index (-1 -> dimSize-1), which may yield an empty slice.
        const rawStopProvided = sel.stop;
        const rawStop = rawStopProvided === undefined
            ? -1
            : (rawStopProvided < 0 ? dimSize + rawStopProvided : rawStopProvided);

        const start = Math.max(
            0,
            Math.min(rawStart < 0 ? dimSize + rawStart : rawStart, dimSize - 1)
        );

        const stop = Math.max(
            -1,
            Math.min(rawStop, dimSize - 1)
        );

        const span  = Math.max(0, start - stop);
        const count = span === 0 ? 0 : Math.ceil(span / Math.abs(step));
        const result = { start: stop + 1, count, step, collapsed: false };
        // For negative step: read forward then reverse later
        return result;
    }
}