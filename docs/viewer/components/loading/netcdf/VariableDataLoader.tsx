'use client';
import React from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent } from '@/components/ui/card';
import { VariableData, VariableArrayData } from './types';

type ArrayElement = number | bigint | string;

const DEFAULT_SLICE_SIZE = 2;

interface VariableDataLoaderProps {
  variableName: string;
  variable: VariableData;
  loadingVariable: string | null;
  onLoadSlice: (name: string, size: number) => void;
  onLoadAll: (name: string) => void;
}

const isIntegerDtype = (dtype: string) =>
  /^(int|uint|i|u)\d+$|^(int8|int16|int32|int64|uint8|uint16|uint32|uint64|byte|ubyte|short|ushort)$/i.test(dtype);

const formatValue = (v: ArrayElement, integer: boolean): string => {
  if (typeof v === 'number') return integer ? String(Math.trunc(v)) : v.toFixed(2);
  if (typeof v === 'bigint') return String(v);
  return String(v);
};

const formatDataPreview = (data: VariableArrayData, dtype: string, baseType?: string, maxItems = 20): string => {
  if (!data) return 'No data';
  const effectiveDtype = baseType ?? dtype;
  const integer = isIntegerDtype(effectiveDtype);
  const len = data.length ?? 0;
  const count = Math.min(maxItems, len);
  const preview = [];
  for (let i = 0; i < count; i++) {
    preview.push(formatValue(data[i] as ArrayElement, integer));
  }
  const suffix = len > maxItems ? `, ... (${len} total)` : '';
  return `[${preview.join(', ')}${suffix}]`;
};

export const VariableDataLoader = ({
  variableName,
  variable,
  loadingVariable,
  onLoadSlice,
  onLoadAll,
}: VariableDataLoaderProps) => {
  const info = variable.info;
  const isLoading = loadingVariable === variableName;
  const isStringType = ['S1', 'char'].includes(info?.dtype ?? '');

  if (!info) return null;

  return (
    <Card className="border-0 py-1">
      <CardContent className="space-y-3 p-2 sm:p-3">

        {/* Load controls */}
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-end">
          {!isStringType && (
            <>
              <div className="flex gap-2 w-full sm:w-auto items-center">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onLoadSlice(variableName, Math.min(DEFAULT_SLICE_SIZE, info.size))}
                  disabled={isLoading}
                  className="flex-1 sm:flex-initial cursor-pointer"
                >
                  Load Test Slice
                </Button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => onLoadAll(variableName)}
                        disabled={isLoading}
                        className="flex-1 sm:flex-initial cursor-pointer"
                      >
                        Load All Data
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Loading all data may be slow or crash for large variables.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {isLoading && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Spinner className="h-4 w-4" />
                    <span className="text-sm text-muted-foreground hidden sm:inline">
                      Loading...
                    </span>
                  </div>
                )}
              </div>
            </>
          )}

          {isStringType && (
            <div className="flex gap-2 items-center">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onLoadAll(variableName)}
                disabled={isLoading}
                className="w-full sm:w-auto cursor-pointer"
              >
                Load String Data
              </Button>
              {isLoading && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Spinner className="h-4 w-4" />
                  <span className="text-sm text-muted-foreground hidden sm:inline">
                    Loading...
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Data preview */}
        {variable.data && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Data Preview:</Label>
            <pre className="bg-muted p-3 rounded font-mono text-xs overflow-x-auto max-w-full whitespace-pre-wrap break-all">
              {formatDataPreview(variable.data, info.dtype, info.dtype_base)}
            </pre>
          </div>
        )}

      </CardContent>
    </Card>
  );
};