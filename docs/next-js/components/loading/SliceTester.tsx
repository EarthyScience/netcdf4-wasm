'use client';
import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Terminal, ChevronRight, ChevronDown } from 'lucide-react';
import { slice as ncSlice } from '@earthyscience/netcdf4-wasm';

// Types
export type SelectionMode = 'all' | 'scalar' | 'slice';

export interface SliceSelectionState {
  mode:   SelectionMode;
  scalar: string;
  start:  string;
  stop:   string;
  step:   string;
}

export function defaultSelection(): SliceSelectionState {
  return { mode: 'all', scalar: '0', start: '0', stop: '', step: '1' };
}

// buildSelection — converts UI state → DimSelection[] for dataset.get()

export function buildSelection(
  sels: SliceSelectionState[],
  shape: Array<number | bigint>
): Array<null | number | ReturnType<typeof ncSlice>> {

  return sels.map((s, i) => {
    const dimSize = Number(shape[i]);

    // ALL
    if (s.mode === 'all') {
      return ncSlice(0, dimSize, 1);
    }

    // SCALAR
    if (s.mode === 'scalar') {
      let idx = parseInt(s.scalar);

      if (Number.isNaN(idx)) idx = 0;

      // normalize negative indices
      if (idx < 0) idx = dimSize + idx;

      if (idx < 0 || idx >= dimSize) {
        throw new Error(`index ${idx} out of bounds for dim ${i} size ${dimSize}`);
      }

      return idx;
    }

    // SLICE
    let start = s.start !== '' ? parseInt(s.start) : 0;
    let stop  = s.stop  !== '' ? parseInt(s.stop)  : dimSize;
    let step  = s.step  !== '' ? parseInt(s.step)  : 1;

    if (Number.isNaN(start)) start = 0;
    if (Number.isNaN(stop))  stop  = dimSize;
    if (Number.isNaN(step))  step  = 1;

    // normalize negatives
    if (start < 0) start = dimSize + start;
    if (stop  < 0) stop  = dimSize + stop;

    return ncSlice(start, stop, step);
  });
}

// SliceTesterSection component

interface SliceTesterSectionProps {
  info:                    any;
  sliceSelections:         SliceSelectionState[];
  setSliceSelections:      React.Dispatch<React.SetStateAction<SliceSelectionState[]>>;
  expandedSliceTester:     boolean;
  setExpandedSliceTester:  (v: boolean) => void;
  sliceResult:             any;
  sliceError:              string | null;
  loadingSlice:            boolean;
  onRun:                   () => void;
}

const SliceTesterSection: React.FC<SliceTesterSectionProps> = ({
  info,
  sliceSelections,
  setSliceSelections,
  expandedSliceTester,
  setExpandedSliceTester,
  sliceResult,
  sliceError,
  loadingSlice,
  onRun,
}) => {
  if (!info?.shape || info.shape.length === 0) return null;

  // Coerce shape to plain numbers — nc_inq_dimlen uses i64 so values may be BigInt
  const shape: number[] = (info.shape as any[]).map(Number);

  const updateSel = (i: number, patch: Partial<SliceSelectionState>) =>
    setSliceSelections(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));

  const resultPreview = sliceResult
    ? (() => {
        const arr = Array.isArray(sliceResult) ? sliceResult : Array.from(sliceResult as any);
        const items = (arr as any[]).slice(0, 30).map((v: any) =>
          typeof v === 'number' ? v.toFixed(4) : String(v)
        );
        const suffix = arr.length > 30 ? `, … (${arr.length} total)` : '';
        return `[${items.join(', ')}${suffix}]`;
      })()
    : null;

  const selectionPreview = sliceSelections.map((s, i) => {
    if (s.mode === 'all') return 'null';
    if (s.mode === 'scalar') return s.scalar || '0';
    const parts: string[] = [s.start || '0', s.stop || String(shape[i])];
    if (s.step && s.step !== '1') parts.push(s.step);
    return `slice(${parts.join(', ')})`;
  }).join(', ');

  return (
    <div className="border-[0.1px] rounded-lg overflow-hidden mt-2">
      {/* Header */}
      <button
        onClick={() => setExpandedSliceTester(!expandedSliceTester)}
        className="w-full flex items-center justify-between p-3 hover:bg-accent/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Slice &amp; Index Tester</span>
          <span className="text-xs text-muted-foreground font-mono">
            shape: [{shape.join(', ')}]
          </span>
        </div>
        {expandedSliceTester
          ? <ChevronDown  className="h-4 w-4 flex-shrink-0" />
          : <ChevronRight className="h-4 w-4 flex-shrink-0" />
        }
      </button>

      {expandedSliceTester && (
        <div className="px-3 pb-3 space-y-3">

          {/* Dimension rows */}
          <div className="space-y-2">
            {shape.map((dimSize: number, i: number) => {
              const dimName = info.dimensions?.[i] ?? `dim_${i}`;
              const sel = sliceSelections[i] ?? defaultSelection();

              return (
                <div key={i} className="border rounded-md p-2 space-y-2 bg-muted/30">
                  {/* Label + mode tabs */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-muted-foreground w-24 shrink-0 truncate">
                      {dimName}
                      <span className="text-muted-foreground/60"> [{dimSize}]</span>
                    </span>
                    <div className="flex rounded-md border overflow-hidden text-xs">
                      {(['all', 'scalar', 'slice'] as SelectionMode[]).map(m => (
                        <button
                          key={m}
                          onClick={() => updateSel(i, { mode: m })}
                          className={`px-2 py-1 transition-colors ${
                            sel.mode === m
                              ? 'bg-primary text-primary-foreground font-semibold'
                              : 'hover:bg-accent/50'
                          }`}
                        >
                          {m === 'all' ? 'null' : m}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Scalar input */}
                  {sel.mode === 'scalar' && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-10">index</span>
                      <Input
                        type="number"
                        min={-dimSize}
                        max={dimSize - 1}
                        value={sel.scalar}
                        onChange={e => updateSel(i, { scalar: e.target.value })}
                        className="h-7 text-xs w-28 font-mono"
                        placeholder="0"
                      />
                      <span className="text-xs text-muted-foreground">
                        (0 … {dimSize - 1}, or negative)
                      </span>
                    </div>
                  )}

                  {/* Slice inputs */}
                  {sel.mode === 'slice' && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {[
                        { label: 'start', key: 'start' as const, placeholder: '0' },
                        { label: 'stop',  key: 'stop'  as const, placeholder: String(dimSize) },
                        { label: 'step',  key: 'step'  as const, placeholder: '1' },
                      ].map(({ label, key, placeholder }) => (
                        <div key={key} className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground w-8">{label}</span>
                          <Input
                            type="number"
                            value={sel[key]}
                            onChange={e => updateSel(i, { [key]: e.target.value })}
                            className="h-7 text-xs w-20 font-mono"
                            placeholder={placeholder}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Selection preview */}
          <div className="text-xs font-mono text-muted-foreground bg-muted/50 rounded px-2 py-1.5 break-all">
            get("{info.name}", [{selectionPreview}])
          </div>

          {/* Run + result count */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={onRun}
              disabled={loadingSlice}
              style={{ backgroundColor: '#644FF0', color: 'white' }}
              className="flex-shrink-0"
            >
              {loadingSlice ? (
                <><Spinner className="h-3 w-3 mr-2" />Running…</>
              ) : 'Run'}
            </Button>
            {sliceResult && (
              <span className="text-xs text-muted-foreground">
                {(() => {
                  const arr = Array.isArray(sliceResult) ? sliceResult : Array.from(sliceResult as any);
                  return `${arr.length} elements`;
                })()}
              </span>
            )}
          </div>

          {/* Error */}
          {sliceError && (
            <Alert variant="destructive" className="py-2">
              <Terminal className="h-4 w-4 flex-shrink-0" />
              <AlertDescription className="text-xs break-words">{sliceError}</AlertDescription>
            </Alert>
          )}

          {/* Result preview */}
          {resultPreview && (
            <pre className="bg-muted p-2 rounded font-mono text-xs overflow-x-auto whitespace-pre-wrap break-all">
              {resultPreview}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

export default SliceTesterSection;