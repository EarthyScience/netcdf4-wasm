import React, { useState, useRef, useCallback, useMemo, useEffect, type RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// ─── Theme / Config ───────────────────────────────────────────────────────────

const THEME = {
  colors: {
    value:   "#e2e8f0",
    muted:   "#64748b",
    accent:  "#94a3b8",
    varName: "#a78bfa",
    dims:    ["#a78bfa", "#f87171", "#fb923c", "#facc15"] as const,
  },
  font: {
    family: "monospace",
    size:   12,
    sizeXs: 11,
  },
} as const;

const CONFIG = {
  fadePx:      48,
  cellH:       18,
  chW:         8,
  overscan:    3,
  maxViewH:    220,
  minViewW:    80,
  scrollSlop:  1,   // px threshold to show edge fade
  rhPadRight:  12,
  colCellPad:  8,
  colHeadPad:  4,
  rhExtraChar: 2,
  rhPadPx:     12,
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type Dtype = string | undefined;

type ScrollEdges = {
  scrollLeft: number;
  scrollTop:  number;
  L: boolean;
  R: boolean;
  T: boolean;
  B: boolean;
};

interface FrozenMatrixProps {
  data:           ArrayLike<number | bigint | string>;
  offset:         number;
  rows:           number;
  cols:           number;
  rowHeaders:     string[];
  colHeaders:     string[];
  rowDim:         string;
  colDim:         string;
  dtype:          Dtype;
  showHeader:     boolean;
  containerWidth: number;
}

interface MatrixDisplayProps {
  data:           ArrayLike<number | bigint | string>;
  rows:           number;
  cols:           number;
  rowDim:         string;
  colDim:         string;
  dtype:          Dtype;
  offset?:        number;
  showHeader?:    boolean;
  containerWidth: number;
}

interface VectorDisplayProps {
  data:           ArrayLike<number | bigint | string>;
  len:            number;
  dimName:        string;
  dtype:          Dtype;
  containerWidth: number;
}

interface NDDisplayProps {
  data:           ArrayLike<number | bigint | string>;
  shape:          number[];
  dimNames:       string[];
  dtype:          Dtype;
  containerWidth: number;
}

interface FooterProps {
  varName?:    string;
  shape:       number[];
  totalShape?: number[];
  dtype:       Dtype;
}

export interface ArrayDisplayProps {
  data:        ArrayLike<number | bigint | string>;
  shape:       number[];
  dimNames?:   string[];
  varName?:    string;
  dtype?:      Dtype;
  totalShape?: number[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtVal(v: number | bigint | string, dtype: Dtype): string {
  if (typeof v === "bigint") return String(v);
  if (typeof v === "string") return v;
  if (!Number.isFinite(v))   return String(v);
  if (dtype?.startsWith("int") || dtype?.startsWith("uint")) return String(Math.trunc(v));
  const abs = Math.abs(v);
  if (abs === 0) return "0";
  if (abs >= 1e5 || (abs < 1e-3 && abs > 0)) return v.toExponential(3);
  return v.toPrecision(8).replace(/\.?0+$/, "");
}

function lpad(s: string, w: number): string {
  return "\u00a0".repeat(Math.max(0, w - s.length)) + s;
}

function formatBytes(b: number): string {
  const units = ["bytes", "KB", "MB", "GB"];
  let v = b, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(2)} ${units[i]}`;
}

function dtypeBytes(d: Dtype): number {
  if (!d) return 4;
  if (d === "S1") return 1;
  if (d === "str" || d === "NAT") return 0;
  const m = d.match(/^[iufc](\d+)$/);
  if (m) return parseInt(m[1], 10);
  if (d.includes("64")) return 8;
  if (d.includes("32")) return 4;
  if (d.includes("16")) return 2;
  if (d.includes("8"))  return 1;
  return 4;
}

// ─── useContainerWidth ────────────────────────────────────────────────────────

function useContainerWidth(ref: RefObject<HTMLElement>): number {
  const [width, setWidth] = useState<number>(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return width;
}

// ─── useScrollState ───────────────────────────────────────────────────────────

function useScrollState(ref: RefObject<HTMLElement>): ScrollEdges {
  const [state, setState] = useState<ScrollEdges>({
    scrollLeft: 0, scrollTop: 0,
    L: false, R: false, T: false, B: false,
  });

  const update = useCallback((): void => {
    const el = ref.current;
    if (!el) return;
    const { scrollLeft, scrollTop, scrollWidth, scrollHeight, clientWidth, clientHeight } = el;
    setState({
      scrollLeft,
      scrollTop,
      L: scrollLeft > CONFIG.scrollSlop,
      R: scrollLeft < scrollWidth  - clientWidth  - CONFIG.scrollSlop,
      T: scrollTop  > CONFIG.scrollSlop,
      B: scrollTop  < scrollHeight - clientHeight - CONFIG.scrollSlop,
    });
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update]);

  return state;
}

// ─── GlassEdge ────────────────────────────────────────────────────────────────

type EdgeDir = "L" | "R" | "T" | "B";

function GlassEdge({ dir }: { dir: EdgeDir }): React.ReactElement {
  const isH     = dir === "L" || dir === "R";
  const size    = `${CONFIG.fadePx}px`;
  const pos: React.CSSProperties = {
    L: { top: 0, left:   0 },
    R: { top: 0, right:  0 },
    T: { top: 0, left:   0 },
    B: { bottom: 0, left: 0 },
  }[dir];
  const gradDir = { L: "to right", R: "to left", T: "to bottom", B: "to top" }[dir];
  const mask = `linear-gradient(${gradDir}, rgba(0,0,0,0.9) 0%, transparent 100%)`;

  return (
    <div style={{
      position:             "absolute",
      ...pos,
      width:                isH ? size : "100%",
      height:               isH ? "100%" : size,
      backdropFilter:       "blur(6px)",
      WebkitBackdropFilter: "blur(6px)",
      WebkitMaskImage:      mask,
      maskImage:            mask,
      pointerEvents:        "none",
      zIndex:               2,
    }} />
  );
}

// ─── FrozenMatrix ─────────────────────────────────────────────────────────────

function FrozenMatrix({
  data, offset, rows, cols,
  rowHeaders, colHeaders,
  rowDim, colDim, dtype,
  showHeader, containerWidth,
}: FrozenMatrixProps): React.ReactElement {

  const cw = useMemo<number[]>(() => {
    const widths = Array.from({ length: cols }, (_, ci) => colHeaders[ci].length);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const len = fmtVal(data[offset + r * cols + c], dtype).length;
        if (len > widths[c]) widths[c] = len;
      }
    }
    return widths;
  }, [data, offset, rows, cols, colHeaders, dtype]);

  const colOffsets = useMemo<number[]>(() => {
    const offs = [0];
    for (let c = 0; c < cols; c++) {
      offs.push(offs[c] + cw[c] * CONFIG.chW + CONFIG.colCellPad);
    }
    return offs; // length = cols + 1; colOffsets[cols] = totalGridW
  }, [cw, cols]);

  const rhW_ch = useMemo<number>(() =>
    Math.max(rowDim.length + CONFIG.rhExtraChar, ...rowHeaders.map(s => s.length)),
  [rowDim, rowHeaders]);

  const rhW        = rhW_ch * CONFIG.chW + CONFIG.rhPadPx;
  const totalGridW = colOffsets[cols];
  const totalGridH = rows * CONFIG.cellH;
  const viewW      = containerWidth ? Math.max(CONFIG.minViewW, containerWidth - rhW) : 200;
  const viewH      = Math.min(totalGridH, CONFIG.maxViewH);

  const gridRef    = useRef<HTMLDivElement>(null);
  const colHeadRef = useRef<HTMLDivElement>(null);
  const rowHeadRef = useRef<HTMLDivElement>(null);

  const scroll = useScrollState(gridRef as RefObject<HTMLElement>);

  const onGridScroll = useCallback((): void => {
    const g = gridRef.current;
    if (!g) return;
    if (colHeadRef.current) colHeadRef.current.scrollLeft = g.scrollLeft;
    if (rowHeadRef.current) rowHeadRef.current.scrollTop  = g.scrollTop;
  }, []);

  const rowStart = Math.max(0,    Math.floor(scroll.scrollTop / CONFIG.cellH) - CONFIG.overscan);
  const rowEnd   = Math.min(rows, Math.ceil((scroll.scrollTop + viewH) / CONFIG.cellH) + CONFIG.overscan);

  const colStart = useMemo<number>(() => {
    let lo = 0, hi = cols;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      colOffsets[mid + 1] <= scroll.scrollLeft ? (lo = mid + 1) : (hi = mid);
    }
    return Math.max(0, lo - CONFIG.overscan);
  }, [colOffsets, cols, scroll.scrollLeft]);

  const colEnd = useMemo<number>(() => {
    let lo = colStart, hi = cols;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      colOffsets[mid] < scroll.scrollLeft + viewW ? (lo = mid + 1) : (hi = mid);
    }
    return Math.min(cols, lo + CONFIG.overscan);
  }, [colOffsets, cols, colStart, scroll.scrollLeft, viewW]);

  const paddingTop    = rowStart * CONFIG.cellH;
  const paddingBottom = (rows - rowEnd) * CONFIG.cellH;
  const paddingLeft   = colOffsets[colStart];
  const paddingRight  = totalGridW - colOffsets[colEnd];

  const S = {
    mono:  {
      fontFamily: THEME.font.family,
      fontSize:   THEME.font.size,
      lineHeight: `${CONFIG.cellH}px`,
      whiteSpace: "nowrap" as const,
    },
    muted: { color: THEME.colors.muted  },
    value: { color: THEME.colors.value  },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>

      {/* dim label row */}
      <div style={{ display: "flex", ...S.mono, marginBottom: 2 }}>
        <div style={{ width: rhW, flexShrink: 0, ...S.muted, textAlign: "right", paddingRight: CONFIG.rhPadRight }}>
          ↓ {rowDim}
        </div>
        <div style={{ width: viewW, overflow: "hidden", flexShrink: 0 }}>
          <div style={{ ...S.muted, paddingLeft: 4 }}>
            → {colDim}{showHeader && dtype ? `  ${dtype}` : ""}
          </div>
        </div>
      </div>

      {/* col-index header (mirrors scrollLeft, windowed) */}
      <div style={{ display: "flex", ...S.mono, marginBottom: 2 }}>
        <div style={{ width: rhW, flexShrink: 0 }} />
        <div ref={colHeadRef} style={{ width: viewW, overflow: "hidden", flexShrink: 0 }}>
          <div style={{ width: totalGridW, display: "flex" }}>
            {paddingLeft > 0 && <div style={{ width: paddingLeft, flexShrink: 0 }} />}
            {Array.from({ length: colEnd - colStart }, (_, i) => {
              const ci = colStart + i;
              return (
                <div
                  key={ci}
                  style={{ width: cw[ci] * CONFIG.chW + CONFIG.colCellPad, flexShrink: 0, textAlign: "right", ...S.muted, paddingRight: CONFIG.colHeadPad }}
                >
                  {colHeaders[ci]}
                </div>
              );
            })}
            {paddingRight > 0 && <div style={{ width: paddingRight, flexShrink: 0 }} />}
          </div>
        </div>
      </div>

      {/* main area */}
      <div style={{ display: "flex" }}>

        {/* frozen row-index column */}
        <div ref={rowHeadRef} style={{ width: rhW, flexShrink: 0, height: viewH, overflow: "hidden" }}>
          <div style={{ height: totalGridH }}>
            {paddingTop > 0 && <div style={{ height: paddingTop }} />}
            {Array.from({ length: rowEnd - rowStart }, (_, i) => {
              const ri = rowStart + i;
              return (
                <div key={ri} style={{ height: CONFIG.cellH, textAlign: "right", paddingRight: CONFIG.rhPadRight, ...S.mono, ...S.muted }}>
                  {rowHeaders[ri]}
                </div>
              );
            })}
            {paddingBottom > 0 && <div style={{ height: paddingBottom }} />}
          </div>
        </div>

        {/* scrollable cell grid */}
        <div style={{ width: viewW, height: viewH, position: "relative", flexShrink: 0 }}>
          {scroll.L && <GlassEdge dir="L" />}
          {scroll.R && <GlassEdge dir="R" />}
          {scroll.T && <GlassEdge dir="T" />}
          {scroll.B && <GlassEdge dir="B" />}

          <div
            ref={gridRef}
            onScroll={onGridScroll}
            style={{ width: "100%", height: "100%", overflow: "scroll", scrollbarWidth: "none" }}
          >
            <div style={{ width: totalGridW, height: totalGridH }}>
              {paddingTop > 0 && <div style={{ height: paddingTop }} />}

              {Array.from({ length: rowEnd - rowStart }, (_, i) => {
                const ri = rowStart + i;
                return (
                  <div key={ri} style={{ display: "flex", height: CONFIG.cellH }}>
                    {paddingLeft > 0 && <div style={{ width: paddingLeft, flexShrink: 0 }} />}

                    {Array.from({ length: colEnd - colStart }, (_, j) => {
                      const ci = colStart + j;
                      const v  = fmtVal(data[offset + ri * cols + ci], dtype);
                      return (
                        <div
                          key={ci}
                          style={{ width: cw[ci] * CONFIG.chW + CONFIG.colCellPad, flexShrink: 0, textAlign: "right", paddingRight: CONFIG.colHeadPad, ...S.mono, ...S.value }}
                        >
                          {lpad(v, cw[ci])}
                        </div>
                      );
                    })}

                    {paddingRight > 0 && <div style={{ width: paddingRight, flexShrink: 0 }} />}
                  </div>
                );
              })}

              {paddingBottom > 0 && <div style={{ height: paddingBottom }} />}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── MatrixDisplay ────────────────────────────────────────────────────────────

function MatrixDisplay({
  data, rows, cols, rowDim, colDim, dtype,
  offset = 0, showHeader = true, containerWidth,
}: MatrixDisplayProps): React.ReactElement {
  const colHeaders = useMemo<string[]>(() => Array.from({ length: cols }, (_, i) => String(i)), [cols]);
  const rowHeaders = useMemo<string[]>(() => Array.from({ length: rows }, (_, i) => String(i)), [rows]);

  return (
    <FrozenMatrix
      data={data} offset={offset} rows={rows} cols={cols}
      rowHeaders={rowHeaders} colHeaders={colHeaders}
      rowDim={rowDim} colDim={colDim} dtype={dtype}
      showHeader={showHeader} containerWidth={containerWidth}
    />
  );
}

// ─── VectorDisplay ────────────────────────────────────────────────────────────

function VectorDisplay({ data, len, dimName, dtype, containerWidth }: VectorDisplayProps): React.ReactElement {
  const rowHeaders = useMemo<string[]>(() => Array.from({ length: len }, (_, i) => String(i)), [len]);
  const colHeaders = useMemo<string[]>(() => [dimName], [dimName]);

  return (
    <FrozenMatrix
      data={data} offset={0} rows={len} cols={1}
      rowHeaders={rowHeaders} colHeaders={colHeaders}
      rowDim="idx" colDim={dimName} dtype={dtype}
      showHeader containerWidth={containerWidth}
    />
  );
}

// ─── NDDisplay ────────────────────────────────────────────────────────────────

function NDDisplay({ data, shape, dimNames, dtype, containerWidth }: NDDisplayProps): React.ReactElement {
  const ndim  = shape.length;
  const rows  = shape[ndim - 2];
  const cols  = shape[ndim - 1];
  const rowDim = dimNames[ndim - 2] ?? `dim_${ndim - 2}`;
  const colDim = dimNames[ndim - 1] ?? `dim_${ndim - 1}`;

  const outerShape = useMemo<number[]>(() => shape.slice(0, ndim - 2), [shape, ndim]);
  const outerDims  = useMemo<string[]>(() => dimNames.slice(0, ndim - 2), [dimNames, ndim]);
  const numSlices  = outerShape.reduce((a, b) => a * b, 1);

  const [sliceIdx, setSliceIdx] = useState<number>(0);

  const outerIdx = useMemo<number[]>(() => {
    const idx: number[] = [];
    let rem = sliceIdx;
    for (let d = outerShape.length - 1; d >= 0; d--) {
      idx[d] = rem % outerShape[d];
      rem = Math.floor(rem / outerShape[d]);
    }
    return idx;
  }, [sliceIdx, outerShape]);

  const offset     = sliceIdx * rows * cols;
  const colHeaders = useMemo<string[]>(() => Array.from({ length: cols }, (_, i) => String(i)), [cols]);
  const rowHeaders = useMemo<string[]>(() => Array.from({ length: rows }, (_, i) => String(i)), [rows]);

  return (
    <div>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        fontFamily: THEME.font.family, fontSize: THEME.font.sizeXs,
        color: THEME.colors.accent, marginBottom: 6, flexWrap: "wrap",
      }}>
        <button
          onClick={() => setSliceIdx(i => Math.max(0, i - 1))}
          disabled={sliceIdx === 0}
          style={{ opacity: sliceIdx === 0 ? 0.3 : 1, background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, display: "flex", alignItems: "center" }}
        >
          <ChevronLeft style={{ width: 12, height: 12 }} />
        </button>

        <span>
          {"["}
          {outerIdx.map((idx, i) => (
            <span key={`outer-${i}`}>
              {i > 0 && <span style={{ color: THEME.colors.muted }}>, </span>}
              <span style={{ color: THEME.colors.dims[i % THEME.colors.dims.length] }}>{idx}</span>
            </span>
          ))}
          <span style={{ color: THEME.colors.muted }}>{outerIdx.length > 0 ? ", " : ""}:, :</span>
          {"]"}
        </span>

        {outerDims.map((d, i) => (
          <span key={`dim-${i}`} style={{ color: THEME.colors.dims[i % THEME.colors.dims.length] }}>
            {d}={outerIdx[i]}
          </span>
        ))}

        <button
          onClick={() => setSliceIdx(i => Math.min(numSlices - 1, i + 1))}
          disabled={sliceIdx === numSlices - 1}
          style={{ opacity: sliceIdx === numSlices - 1 ? 0.3 : 1, background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, display: "flex", alignItems: "center" }}
        >
          <ChevronRight style={{ width: 12, height: 12 }} />
        </button>

        <span style={{ marginLeft: "auto" }}>{sliceIdx + 1}/{numSlices}</span>
      </div>

      <FrozenMatrix
        data={data} offset={offset} rows={rows} cols={cols}
        rowHeaders={rowHeaders} colHeaders={colHeaders}
        rowDim={rowDim} colDim={colDim} dtype={dtype}
        showHeader={false} containerWidth={containerWidth}
      />
    </div>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer({ varName, shape, totalShape, dtype }: FooterProps): React.ReactElement {
  const bpp = dtypeBytes(dtype);
  const sb  = shape.reduce((a, b) => a * b, 1) * bpp;
  const has = (totalShape?.length ?? 0) > 0;
  const tb  = has && totalShape ? totalShape.reduce((a, b) => a * b, 1) * bpp : null;

  return (
    <div style={{
      fontFamily: THEME.font.family, fontSize: THEME.font.sizeXs,
      color: THEME.colors.muted, marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap",
    }}>
      {varName && <span style={{ color: THEME.colors.varName }}>{varName}</span>}
      <span>
        [{shape.join(", ")}]
        <span style={{ opacity: 0.6, marginLeft: 4 }}>{formatBytes(sb)}</span>
      </span>
      {has && tb !== null && <>
        <span style={{ opacity: 0.4 }}>/</span>
        <span style={{ opacity: 0.6 }}>
          [{totalShape!.join(", ")}]
          <span style={{ marginLeft: 4 }}>{formatBytes(tb)}</span>
        </span>
      </>}
    </div>
  );
}

// ─── ArrayDisplay ─────────────────────────────────────────────────────────────

export function ArrayDisplay({
  data, shape, dimNames = [], varName, dtype, totalShape,
}: ArrayDisplayProps): React.ReactElement {
  const containerRef   = useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(containerRef as RefObject<HTMLElement>);

  const ndim  = shape.length;
  const total = shape.reduce((a, b) => a * b, 1);
  const names = shape.map((_, i) => dimNames[i] ?? `dim_${i}`);

  let body: React.ReactElement;
  if (ndim === 0 || total === 1) {
    body = (
      <div style={{ fontFamily: THEME.font.family, fontSize: THEME.font.size, color: THEME.colors.value }}>
        {fmtVal(data[0], dtype)}
      </div>
    );
  } else if (ndim === 1) {
    body = <VectorDisplay data={data} len={shape[0]} dimName={names[0]} dtype={dtype} containerWidth={containerWidth} />;
  } else if (ndim === 2) {
    body = <MatrixDisplay data={data} rows={shape[0]} cols={shape[1]} rowDim={names[0]} colDim={names[1]} dtype={dtype} containerWidth={containerWidth} />;
  } else {
    body = <NDDisplay data={data} shape={shape} dimNames={names} dtype={dtype} containerWidth={containerWidth} />;
  }

  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      {body}
      <Footer varName={varName} shape={shape} totalShape={totalShape} dtype={dtype} />
    </div>
  );
}

export default ArrayDisplay;