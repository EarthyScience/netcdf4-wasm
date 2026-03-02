'use client';
import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ArrayDisplayProps {
  data:      ArrayLike<number | bigint | string>;
  shape:     number[];
  dimNames?: string[];
  varName?:  string;
  dtype?:    string;
  maxRows?:  number;
  maxCols?:  number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtVal(v: number | bigint | string, dtype?: string): string {
  if (typeof v === 'bigint') return String(v);
  if (typeof v === 'string') return v;
  if (!Number.isFinite(v))   return String(v);
  if (dtype?.startsWith('int') || dtype?.startsWith('uint')) return String(Math.trunc(v));
  const abs = Math.abs(v);
  if (abs === 0) return '0';
  if (abs >= 1e5 || (abs < 1e-3 && abs > 0)) return v.toExponential(3);
  return v.toPrecision(6).replace(/\.?0+$/, '');
}

function lpad(s: string, w: number) {
  return ' '.repeat(Math.max(0, w - s.length)) + s;
}

// ─── Dim colors (cycles per outer dim index) ─────────────────────────────────

const DIM_COLORS = [
  '#a78bfa', // purple
  '#f87171', // tomato
  '#fb923c', // orange
  '#facc15', // amber
];

// ─── Scalar ───────────────────────────────────────────────────────────────────

const ScalarDisplay: React.FC<{ value: string; dtype?: string }> = ({ value, dtype }) => (
  <div className="font-mono text-xs space-y-0.5">
    {dtype && <div className="text-muted-foreground">{dtype}</div>}
    <div>{value}</div>
  </div>
);

// ─── Vector ───────────────────────────────────────────────────────────────────

interface VectorProps {
  data:    ArrayLike<number | bigint | string>;
  len:     number;
  dimName: string;
  dtype?:  string;
  maxRows: number;
}
const VectorDisplay: React.FC<VectorProps> = ({ data, len, dimName, dtype, maxRows }) => {
  const vals = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < len; i++) out.push(fmtVal(data[i] as never, dtype));
    return out;
  }, [data, len, dtype]);

  const valW  = Math.max(...vals.map(s => s.length));
  const idxW  = String(len - 1).length;
  const shown = Math.min(len, maxRows);

  return (
    <div className="font-mono text-xs">
      <div className="text-muted-foreground mb-2 flex gap-3">
        <span>↓ {dimName}</span>
        {dtype && <span>{dtype}</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0">
          <tbody>
            {Array.from({ length: shown }, (_, i) => (
              <tr key={i}>
                <td className="pr-3 text-muted-foreground select-none text-right" style={{ minWidth: `${idxW + 1}ch` }}>{i}</td>
                <td className="text-right" style={{ minWidth: `${valW + 1}ch` }}>{vals[i]}</td>
              </tr>
            ))}
            {len > maxRows && (
              <tr><td colSpan={2} className="text-muted-foreground pt-1">⋮  ({len - maxRows} more)</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Matrix ───────────────────────────────────────────────────────────────────

interface MatrixProps {
  data:        ArrayLike<number | bigint | string>;
  rows:        number;
  cols:        number;
  rowDim:      string;
  colDim:      string;
  dtype?:      string;
  maxRows:     number;
  maxCols:     number;
  offset?:     number;
  showHeader?: boolean;
}
const MatrixDisplay: React.FC<MatrixProps> = ({
  data, rows, cols, rowDim, colDim, dtype, maxRows, maxCols, offset = 0, showHeader = true,
}) => {
  const shownRows = Math.min(rows, maxRows);
  const shownCols = Math.min(cols, maxCols);
  const truncR    = rows > maxRows;
  const truncC    = cols > maxCols;

  const grid = useMemo(() => {
    const g: string[][] = [];
    for (let r = 0; r < shownRows; r++) {
      const row: string[] = [];
      for (let c = 0; c < shownCols; c++) {
        row.push(fmtVal((data as never)[offset + r * cols + c], dtype));
      }
      g.push(row);
    }
    return g;
  }, [data, shownRows, shownCols, cols, dtype, offset]);

  const colHeaders = Array.from({ length: shownCols }, (_, i) => String(i));
  const rowHeaders = Array.from({ length: shownRows }, (_, i) => String(i));
  const cw = Array.from({ length: shownCols }, (_, ci) =>
    Math.max(colHeaders[ci].length, ...grid.map(row => row[ci]?.length ?? 0))
  );
  const rhW = Math.max(rowDim.length + 2, ...rowHeaders.map(s => s.length));

  return (
    <div className="font-mono text-xs">
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="text-right pr-3 text-muted-foreground font-normal" style={{ minWidth: `${rhW}ch` }}>
                ↓ {rowDim}
              </th>
              <th colSpan={shownCols + (truncC ? 1 : 0)} className="text-muted-foreground font-normal pb-0.5 text-left pl-2">
                → {colDim}
              </th>
              {showHeader && dtype && (
                <th className="text-muted-foreground font-normal pl-4 text-left">{dtype}</th>
              )}
            </tr>
            <tr>
              <th className="text-right pr-3 text-muted-foreground font-normal" />
              {colHeaders.map((h, ci) => (
                <th key={ci} className="pl-2 text-right text-muted-foreground font-normal" style={{ minWidth: `${cw[ci] + 1}ch` }}>
                  {lpad(h, cw[ci])}
                </th>
              ))}
              {truncC && <th className="pl-2 text-muted-foreground">…</th>}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, ri) => (
              <tr key={ri}>
                <td className="text-right pr-3 text-muted-foreground">{lpad(rowHeaders[ri], rhW)}</td>
                {row.map((v, ci) => (
                  <td key={ci} className="pl-2 text-right" style={{ minWidth: `${cw[ci] + 1}ch` }}>
                    {lpad(v, cw[ci])}
                  </td>
                ))}
                {truncC && <td className="pl-2 text-muted-foreground">…</td>}
              </tr>
            ))}
            {truncR && (
              <tr>
                <td className="text-muted-foreground">⋮</td>
                <td colSpan={shownCols + (truncC ? 1 : 0)} className="text-muted-foreground pl-2">
                  ({rows - maxRows} more rows)
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── ND (3D+) ─────────────────────────────────────────────────────────────────

interface NDProps {
  data:     ArrayLike<number | bigint | string>;
  shape:    number[];
  dimNames: string[];
  dtype?:   string;
  maxRows:  number;
  maxCols:  number;
}
const NDDisplay: React.FC<NDProps> = ({ data, shape, dimNames, dtype, maxRows, maxCols }) => {
  const ndim       = shape.length;
  const rows       = shape[ndim - 2];
  const cols       = shape[ndim - 1];
  const rowDim     = dimNames[ndim - 2] ?? `dim_${ndim - 2}`;
  const colDim     = dimNames[ndim - 1] ?? `dim_${ndim - 1}`;
  const outerShape = shape.slice(0, ndim - 2);
  const outerDims  = dimNames.slice(0, ndim - 2);
  const numSlices  = outerShape.reduce((a, b) => a * b, 1);

  const [sliceIdx, setSliceIdx] = useState(0);

  const outerIdxForSlice = (si: number): number[] => {
    const idx: number[] = [];
    let rem = si;
    for (let d = outerShape.length - 1; d >= 0; d--) {
      idx[d] = rem % outerShape[d];
      rem = Math.floor(rem / outerShape[d]);
    }
    return idx;
  };

  const outerIdx = outerIdxForSlice(sliceIdx);
  const offset   = sliceIdx * rows * cols;

  const sliceProxy = new Proxy(data as ArrayLike<number>, {
    get(target, prop) {
      if (typeof prop === 'string' && !Number.isNaN(+prop)) return target[offset + +prop];
      return (target as never)[prop];
    },
  });

  return (
    <div className="font-mono text-xs space-y-2">
      <div className="flex items-center gap-2 text-muted-foreground text-xs flex-wrap">
        <button
          onClick={() => setSliceIdx(i => Math.max(0, i - 1))}
          disabled={sliceIdx === 0}
          className="disabled:opacity-30 hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-3 w-3" />
        </button>
        {/* bracket: colored outer indices + muted colons for matrix dims */}
        <span>
          {'['}
          {outerIdx.map((idx, i) => (
            <span key={i}>
              {i > 0 && <span className="text-muted-foreground">, </span>}
              <span style={{ color: DIM_COLORS[i % DIM_COLORS.length] }}>{idx}</span>
            </span>
          ))}
          <span className="text-muted-foreground">{outerIdx.length > 0 ? ', ' : ''}:, :</span>
          {']'}
        </span>
        {/* outer dim name=value, colored */}
        {outerDims.map((d, i) => (
          <span key={i} style={{ color: DIM_COLORS[i % DIM_COLORS.length] }}>
            {d}={outerIdx[i]}
          </span>
        ))}
        {/* matrix dim names, no value */}
        <span className="text-muted-foreground">{rowDim}</span>
        <span className="text-muted-foreground">{colDim}</span>
        {/* dtype */}
        {dtype && <span className="text-muted-foreground">{dtype}</span>}
        <button
          onClick={() => setSliceIdx(i => Math.min(numSlices - 1, i + 1))}
          disabled={sliceIdx === numSlices - 1}
          className="disabled:opacity-30 hover:text-foreground transition-colors"
        >
          <ChevronRight className="h-3 w-3" />
        </button>
        <span className="ml-auto">{sliceIdx + 1}/{numSlices}</span>
      </div>

      <MatrixDisplay
        data={sliceProxy}
        rows={rows}
        cols={cols}
        rowDim={rowDim}
        colDim={colDim}
        dtype={dtype}
        maxRows={maxRows}
        maxCols={maxCols}
        showHeader={false}
      />
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────

export const ArrayDisplay: React.FC<ArrayDisplayProps> = ({
  data,
  shape,
  dimNames = [],
  varName,
  dtype,
  maxRows = 24,
  maxCols = 16,
}) => {
  const ndim  = shape.length;
  const total = shape.reduce((a, b) => a * b, 1);
  const names = shape.map((_, i) => dimNames[i] ?? `dim_${i}`);

  if (ndim === 0 || total === 1) {
    return <ScalarDisplay value={fmtVal(data[0] as never, dtype)} dtype={dtype} />;
  }

  if (ndim === 1) {
    return <VectorDisplay data={data} len={shape[0]} dimName={names[0]} dtype={dtype} maxRows={maxRows} />;
  }

  if (ndim === 2) {
    return (
      <MatrixDisplay
        data={data} rows={shape[0]} cols={shape[1]}
        rowDim={names[0]} colDim={names[1]}
        dtype={dtype} maxRows={maxRows} maxCols={maxCols}
      />
    );
  }

  return (
    <NDDisplay
      data={data} shape={shape} dimNames={names}
      dtype={dtype} maxRows={maxRows} maxCols={maxCols}
    />
  );
};

export default ArrayDisplay;