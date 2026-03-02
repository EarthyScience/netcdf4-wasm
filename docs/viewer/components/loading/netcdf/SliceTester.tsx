'use client';
import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Terminal, ChevronRight, ChevronDown } from 'lucide-react';
import { slice as ncSlice } from '@earthyscience/netcdf4-wasm';
import { VariableInfo, VariableArrayData } from './types';
import ArrayDisplay from './ArrayDisplay';

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

    if (s.mode === 'all') return null;

    if (s.mode === 'scalar') {
      let idx = parseInt(s.scalar);
      if (Number.isNaN(idx)) idx = 0;
      if (idx < 0) idx = dimSize + idx;
      if (idx < 0 || idx >= dimSize) {
        throw new Error(`index ${idx} out of bounds for dim ${i} size ${dimSize}`);
      }
      return idx;
    }

    let start = s.start !== '' ? parseInt(s.start) : 0;
    let stop  = s.stop  !== '' ? parseInt(s.stop)  : dimSize;
    let step  = s.step  !== '' ? parseInt(s.step)  : 1;

    if (Number.isNaN(start)) start = 0;
    if (Number.isNaN(stop))  stop  = dimSize;
    if (Number.isNaN(step))  step  = 1;

    if (start < 0) start = dimSize + start;
    if (stop  < 0) stop  = dimSize + stop;

    return ncSlice(start, stop, step);
  });
}

export function resultShape(
  sels: SliceSelectionState[],
  shape: Array<number | bigint>
): number[] {
  const out: number[] = [];
  sels.forEach((s, i) => {
    const dimSize = Number(shape[i]);
    if (s.mode === 'scalar') return;
    if (s.mode === 'all') { out.push(dimSize); return; }
    const start = s.start !== '' ? parseInt(s.start) : 0;
    const stop  = s.stop  !== '' ? parseInt(s.stop)  : dimSize;
    const step  = s.step  !== '' ? parseInt(s.step)  : 1;
    out.push(Math.max(0, Math.ceil((stop - start) / step)));
  });
  return out;
}

interface SliceTesterSectionProps {
  info:                   VariableInfo;
  sliceSelections:        SliceSelectionState[];
  setSliceSelections:     React.Dispatch<React.SetStateAction<SliceSelectionState[]>>;
  expandedSliceTester:    boolean;
  setExpandedSliceTester: (v: boolean) => void;
  sliceResult:            VariableArrayData | null;
  sliceError:             string | null;
  loadingSlice:           boolean;
  onRun:                  () => void;
}

const SliceTester: React.FC<SliceTesterSectionProps> = ({
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

  const shape: number[] = info.shape.map(Number);

  const updateSel = (i: number, patch: Partial<SliceSelectionState>) =>
    setSliceSelections(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));

  const rShape = resultShape(sliceSelections, info.shape);
  const rDims  = info.dimensions?.filter((_, i) => sliceSelections[i]?.mode !== 'scalar');

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
            {shape.map((dimSize, i) => {
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
                        { label: 'start', key: 'start' as const, placeholder: '0'            },
                        { label: 'stop',  key: 'stop'  as const, placeholder: String(dimSize) },
                        { label: 'step',  key: 'step'  as const, placeholder: '1'             },
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
            {`dataset.get("${info.name}", [${
              sliceSelections.map((s, i) => {
                if (s.mode === 'all') return 'null';
                if (s.mode === 'scalar') return s.scalar || '0';
                const dimSize = shape[i];
                const parts: string[] = [s.start || '0', s.stop || String(dimSize)];
                if (s.step && s.step !== '1') parts.push(s.step);
                return `slice(${parts.join(', ')})`;
              }).join(', ')
            }])`}
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
              {loadingSlice
                ? <><Spinner className="h-3 w-3 mr-2" />Running…</>
                : 'Run'
              }
            </Button>
            {sliceResult && (
              <span className="text-xs text-muted-foreground">
                {sliceResult.length ?? 0} elements
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

          {/* Result display */}
          {sliceResult && (
            <ArrayDisplay
              data={sliceResult}
              shape={rShape}
              dimNames={rDims}
              varName={info.name}
              dtype={info.dtype}
              totalShape={info.shape.map(Number)}
            />
          )}

        </div>
      )}
    </div>
  );
};

export { SliceTester };
export default SliceTester;