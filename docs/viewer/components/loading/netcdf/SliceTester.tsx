'use client';
import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { PlusIcon, MinusIcon } from 'lucide-react';
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

const MODE_ACCENT: Record<SelectionMode, string> = {
  all:    'border-l-muted-foreground/30',
  scalar: 'border-l-blue-500',
  slice:  'border-l-violet-500',
};

const MODE_BADGE: Record<SelectionMode, string> = {
  all:    'text-muted-foreground/50',
  scalar: 'text-blue-500',
  slice:  'text-violet-500',
};

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
      if (idx < -dimSize || idx >= dimSize)
        throw new Error(`index ${idx} out of bounds for dim ${i} size ${dimSize}`);
      if (idx < 0) idx = dimSize + idx;
      return idx;
    }
    let start = s.start !== '' ? parseInt(s.start) : 0;
    let stop  = s.stop  !== '' ? parseInt(s.stop)  : dimSize;
    let step  = s.step  !== '' ? parseInt(s.step)  : 1;
    if (Number.isNaN(start)) start = 0;
    if (Number.isNaN(stop))  stop  = dimSize;
    if (Number.isNaN(step))  step  = 1;
    if (step === 0)          step  = 1;
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
    const normStart = start < 0 ? Math.max(0, dimSize + start) : Math.min(start, dimSize);
    const normStop  = stop  < 0 ? Math.max(0, dimSize + stop)  : Math.min(stop,  dimSize);
    if (step === 0) { out.push(0); return; }
    out.push(Math.max(0, Math.ceil((normStop - normStart) / Math.abs(step))));
  });
  return out;
}

function dimElementCount(s: SliceSelectionState, dimSize: number): number | null {
  if (s.mode === 'scalar') return null;
  if (s.mode === 'all') return dimSize;
  const start = s.start !== '' ? parseInt(s.start) : 0;
  const stop  = s.stop  !== '' ? parseInt(s.stop)  : dimSize;
  const step  = s.step  !== '' ? parseInt(s.step)  : 1;
  if (Number.isNaN(start) || Number.isNaN(stop) || Number.isNaN(step) || step === 0) return null;
  const normStart = start < 0 ? Math.max(0, dimSize + start) : Math.min(start, dimSize);
  const normStop  = stop  < 0 ? Math.max(0, dimSize + stop)  : Math.min(stop,  dimSize);
  return Math.max(0, Math.ceil((normStop - normStart) / Math.abs(step)));
}

/** Format the dim badge: for slice → "start:step:stop", for all → count, for scalar → "collapsed" */
function dimBadge(s: SliceSelectionState, dimSize: number): string | null {
  if (s.mode === 'scalar') return 'collapsed';
  if (s.mode === 'all') return String(dimSize);
  // slice: show start:step:stop
  const start = s.start !== '' ? s.start : '0';
  const stop  = s.stop  !== '' ? s.stop  : String(dimSize);
  const step  = s.step  !== '' ? s.step  : '1';
  return `${start}:${step}:${stop}`;
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

  const changeBy = (i: number, key: keyof Omit<SliceSelectionState, 'mode'>, delta: number) => {
    setSliceSelections(prev => prev.map((s, idx) => {
      if (idx !== i) return s;
      const dimSize = Number(shape[i]);
      let val = parseInt(s[key] || '0');
      if (Number.isNaN(val)) val = 0;
      val += delta;
      if (key === 'step') {
        if (val === 0) val = delta > 0 ? 1 : -1;
        val = Math.max(-dimSize, Math.min(dimSize, val));
      } else {
        const lo = -dimSize;
        const hi = key === 'stop' ? dimSize : dimSize - 1;
        val = Math.max(lo, Math.min(hi, val));
      }
      return { ...s, [key]: String(val) } as SliceSelectionState;
    }));
  };

  const rShape = resultShape(sliceSelections, info.shape);
  const rDims  = info.dimensions?.filter((_, i) => sliceSelections[i]?.mode !== 'scalar');

  return (
    <div className="border-[0.1px] rounded-lg overflow-hidden mt-2">
      {/* Header */}
      <button
        onClick={() => setExpandedSliceTester(!expandedSliceTester)}
        className="w-full flex items-center justify-between p-3 hover:bg-accent/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold truncate">{info.name}</span>
          <span className="text-xs text-muted-foreground font-mono shrink-0">
            [{shape.join(', ')}] Data viewer
          </span>
        </div>
        {expandedSliceTester
          ? <ChevronDown  className="h-4 w-4 flex-shrink-0 text-muted-foreground ml-2" />
          : <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground ml-2" />
        }
      </button>

      {expandedSliceTester && (
        <div className="px-3 pb-3 space-y-2">

          {/* Dimension rows */}
          <div className="space-y-1.5">
            {shape.map((dimSize, i) => {
              const dimName = info.dimensions?.[i] ?? `dim_${i}`;
              const sel     = sliceSelections[i] ?? defaultSelection();
              const badge   = dimBadge(sel, dimSize);

              return (
                <div
                  key={i}
                  className={`border border-l-2 rounded-md px-2 py-1.5 space-y-1.5 bg-muted/20 transition-colors ${MODE_ACCENT[sel.mode]}`}
                >
                  {/* Row: dim name + badge + mode tabs */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                      <span className="font-mono text-xs text-muted-foreground shrink-0">
                        {dimName}
                        <span className="text-muted-foreground/50"> [{dimSize}]</span>
                      </span>
                      {badge !== null && (
                        <span className={`text-xs font-mono shrink-0 ${MODE_BADGE[sel.mode]}`}>
                          → {badge}
                        </span>
                      )}
                    </div>

                    {/* Mode tabs — right-aligned */}
                    <div className="flex rounded-md border overflow-hidden text-xs shrink-0">
                      {(['all', 'scalar', 'slice'] as SelectionMode[]).map(m => (
                        <button
                          key={m}
                          onClick={() => updateSel(i, { mode: m })}
                          className={`px-2 py-1 transition-colors cursor-pointer ${
                            sel.mode === m
                              ? 'bg-primary text-primary-foreground font-semibold'
                              : 'hover:bg-accent/50'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Scalar input */}
                  {sel.mode === 'scalar' && (
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-xs text-muted-foreground w-10">index</span>
                      <ButtonGroup orientation="horizontal" className="h-7">
                        <Button variant="outline" size="icon-sm" className="h-7 w-7 p-0 cursor-pointer" onClick={() => changeBy(i, 'scalar', -1)}>
                          <MinusIcon className="h-4 w-4" />
                        </Button>
                        <Input
                          type="number"
                          min={-dimSize}
                          max={dimSize - 1}
                          value={sel.scalar}
                          onChange={e => updateSel(i, { scalar: e.target.value })}
                          className="h-7 text-xs w-20 font-mono text-center appearance-none"
                          placeholder="0"
                        />
                        <Button variant="outline" size="icon-sm" className="h-7 w-7 p-0 cursor-pointer" onClick={() => changeBy(i, 'scalar', +1)}>
                          <PlusIcon className="h-4 w-4" />
                        </Button>
                      </ButtonGroup>
                      <span className="text-xs text-muted-foreground">
                        ({-dimSize} to {dimSize - 1})
                      </span>
                    </div>
                  )}

                  {/* Slice inputs — all 3 in one responsive row, equal width */}
                  {sel.mode === 'slice' && (
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'start', key: 'start' as const, placeholder: '0',             min: -dimSize, max: dimSize - 1 },
                        { label: 'step',  key: 'step'  as const, placeholder: '1',             min: -dimSize, max: dimSize     },
                        { label: 'stop',  key: 'stop'  as const, placeholder: String(dimSize), min: -dimSize, max: dimSize     },
                      ].map(({ label, key, placeholder, min, max }) => (
                        <div key={key} className="flex flex-col items-center gap-1">
                          <span className="text-xs text-muted-foreground">{label}</span>
                          <ButtonGroup orientation="horizontal" className="h-7 w-full">
                            <Button variant="outline" size="icon-sm" className="h-7 w-7 p-0 cursor-pointer shrink-0" onClick={() => changeBy(i, key, -1)}>
                              <MinusIcon className="h-4 w-4" />
                            </Button>
                            <Input
                              type="number"
                              min={min}
                              max={max}
                              value={sel[key]}
                              onChange={e => updateSel(i, { [key]: e.target.value })}
                              className="h-7 text-xs min-w-0 flex-1 font-mono text-center appearance-none"
                              placeholder={placeholder}
                            />
                            <Button variant="outline" size="icon-sm" className="h-7 w-7 p-0 cursor-pointer shrink-0" onClick={() => changeBy(i, key, +1)}>
                              <PlusIcon className="h-4 w-4" />
                            </Button>
                          </ButtonGroup>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Selection preview + Run — two separate lines so Run never overflows */}
          <div className="bg-muted/50 rounded px-2 py-1.5 space-y-1.5">
            <div className="text-xs font-mono text-muted-foreground break-all">
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
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={onRun}
                disabled={loadingSlice}
                style={{ backgroundColor: '#644FF0', color: 'white' }}
                className="h-7 text-xs px-3 cursor-pointer"
              >
                {loadingSlice
                  ? <><Spinner className="h-3 w-3 mr-1.5" />Running...</>
                  : 'Run'
                }
              </Button>
              {sliceResult && (
                <span className="text-xs text-muted-foreground">
                  {sliceResult.length ?? 0} elements
                </span>
              )}
            </div>
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