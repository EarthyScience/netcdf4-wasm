'use client';
import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { VariableData } from './types';

interface VariableDetailsProps {
  variableName: string;
  variable: VariableData;
  loadingVariable: string | null;
  sliceSize: string;
  expandedVariableInfo: boolean;
  expandedVariableAttrs: boolean;
  expandedEnumDict: boolean;
  onSliceSizeChange: (value: string) => void;
  onToggleVariableInfo: () => void;
  onToggleVariableAttrs: () => void;
  onToggleEnumDict: () => void;
  onLoadSlice: (name: string, size: number) => void;
  onLoadAll: (name: string) => void;
}

const formatDataPreview = (data: any, maxItems = 20) => {
  if (!data) return 'No data';
  const arr = Array.isArray(data) ? data : Array.from(data);
  const preview = arr
    .slice(0, maxItems)
    .map((v) => (typeof v === 'number' ? v.toFixed(4) : String(v)));
  const suffix = arr.length > maxItems ? `, ... (${arr.length} total)` : '';
  return `[${preview.join(', ')}${suffix}]`;
};

export const VariableDetails = ({
  variableName,
  variable,
  loadingVariable,
  sliceSize,
  expandedVariableInfo,
  expandedVariableAttrs,
  expandedEnumDict,
  onSliceSizeChange,
  onToggleVariableInfo,
  onToggleVariableAttrs,
  onToggleEnumDict,
  onLoadSlice,
  onLoadAll,
}: VariableDetailsProps) => {
  const info = variable.info;
  const isLoading = loadingVariable === variableName;

  return (
    <Card className="border-0 py-1">
      <CardContent className="space-y-3 p-2 sm:p-3">
        {info && (
          <div className="space-y-2">
            {/* Variable Info */}
            <div className="border-[0.1px] rounded-lg overflow-hidden">
              <button
                onClick={onToggleVariableInfo}
                className="w-full flex items-center justify-between p-3 hover:bg-accent/50 transition-colors cursor-pointer"
              >
                <span className="text-sm font-semibold">Variable Info</span>
                {expandedVariableInfo ? (
                  <ChevronDown className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 flex-shrink-0" />
                )}
              </button>

              {expandedVariableInfo && (
                <div className="max-h-[300px] overflow-y-auto px-3 pb-3 space-y-2 sm:space-y-1 text-xs overflow-x-auto">
                  {(
                    [
                      ['name', info.name],
                      ['dtype', info.dtype],
                      ...(info.nctype !== undefined ? [['nctype', info.nctype]] : []),
                      ['shape', `[${info.shape.join(', ')}]`],
                      ['dimensions', `[${info.dimensions?.join(', ') || 'N/A'}]`],
                      ['size', info.size.toLocaleString()],
                      ...(info.totalSize !== undefined
                        ? [['totalSize', `${info.totalSize.toLocaleString()} bytes`]]
                        : []),
                      ...(info.chunked !== undefined ? [['chunked', String(info.chunked)]] : []),
                      ...(info.chunks ? [['chunks', `[${info.chunks.join(', ')}]`]] : []),
                      ...(info.chunkSize !== undefined
                        ? [['chunkSize', `${info.chunkSize.toLocaleString()} bytes`]]
                        : []),
                    ] as [string, string][]
                  ).map(([label, value]) => (
                    <div
                      key={label}
                      className="flex flex-col sm:grid sm:grid-cols-[150px_1fr] gap-0.5 sm:gap-2 min-w-0"
                    >
                      <span className="font-mono text-muted-foreground">{label}:</span>
                      <span className="font-mono break-all pl-4 sm:pl-0">{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Enum Dictionary */}
            {info.enum && Object.keys(info.enum).length > 0 && (
              <div className="border-0 rounded-lg overflow-hidden">
                <button
                  onClick={onToggleEnumDict}
                  className="w-full flex items-center justify-between p-3 hover:bg-accent/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold truncate">Values</span>
                    {info.enumType && (
                      <span className="text-xs text-muted-foreground font-mono">
                        ({info.enumType.name})
                      </span>
                    )}
                  </div>
                  {expandedEnumDict ? (
                    <ChevronDown className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 flex-shrink-0" />
                  )}
                </button>

                {expandedEnumDict && (
                  <div className="max-h-[300px] overflow-y-auto px-3 pb-3 space-y-2 sm:space-y-1 text-xs overflow-x-auto">
                    <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                      {Object.entries(info.enum as Record<string, string>)
                        .sort(([a], [b]) => Number(a) - Number(b))
                        .map(([value, label]) => (
                          <React.Fragment key={value}>
                            <span className="font-mono text-muted-foreground text-right">
                              {value}:
                            </span>
                            <span className="font-mono break-all">{String(label)}</span>
                          </React.Fragment>
                        ))}
                    </div>
                    {info.enumType && (
                      <div className="mt-3 pt-3 border-t text-muted-foreground">
                        <div className="flex items-center gap-2 text-xs">
                          <span>Base Type:</span>
                          <span className="font-mono">
                            {info.dtype_base || `NC_TYPE_${info.enumType.baseType}`}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Variable Attributes */}
            {info.attributes && Object.keys(info.attributes).length > 0 && (
              <div className="border-0 rounded-lg overflow-hidden">
                <button
                  onClick={onToggleVariableAttrs}
                  className="w-full flex items-center justify-between p-3 hover:bg-accent/50 transition-colors cursor-pointer"
                >
                  <span className="text-sm font-semibold truncate">
                    Variable Attributes ({Object.keys(info.attributes).length})
                  </span>
                  {expandedVariableAttrs ? (
                    <ChevronDown className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 flex-shrink-0" />
                  )}
                </button>

                {expandedVariableAttrs && (
                  <div className="max-h-[300px] overflow-y-auto px-3 pb-3 space-y-2 sm:space-y-1 text-xs overflow-x-auto">
                    {Object.entries(info.attributes).map(([k, v]) => (
                      <div
                        key={k}
                        className="flex flex-col sm:grid sm:grid-cols-[minmax(100px,auto)_1fr] gap-0.5 sm:gap-2 min-w-0"
                      >
                        <span className="font-mono text-muted-foreground">{k}:</span>
                        <span className="font-mono break-all pl-4 sm:pl-0">
                          {typeof v === 'object'
                            ? JSON.stringify(v, (_k, val) =>
                                typeof val === 'bigint' ? Number(val) : val
                              )
                            : String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Data Loading Controls */}
            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-end">
              {!['S1', 'char'].includes(info.dtype) && (
                <>
                  <div className="w-full sm:w-32">
                    <Label className="text-xs text-muted-foreground mb-1 block">Slice size</Label>
                    <Input
                      type="number"
                      min="1"
                      max={info.size}
                      value={sliceSize}
                      onChange={(e) => onSliceSizeChange(e.target.value)}
                      className="h-9 text-sm"
                      placeholder="10"
                    />
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto items-center">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        onLoadSlice(variableName, Math.min(parseInt(sliceSize) || 10, info.size))
                      }
                      disabled={isLoading}
                      className="flex-1 sm:flex-initial"
                    >
                      Load Slice
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onLoadAll(variableName)}
                      disabled={isLoading}
                      className="flex-1 sm:flex-initial"
                    >
                      Load All
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
                </>
              )}

              {['S1', 'char'].includes(info.dtype) && (
                <div className="flex gap-2 items-center">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onLoadAll(variableName)}
                    disabled={isLoading}
                    className="w-full sm:w-auto"
                  >
                    Load All
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
          </div>
        )}

        {/* Data Preview */}
        {variable.data && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Data Preview:</Label>
            <pre className="bg-muted p-3 rounded font-mono text-xs overflow-x-auto max-w-full whitespace-pre-wrap break-all">
              {formatDataPreview(variable.data)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
