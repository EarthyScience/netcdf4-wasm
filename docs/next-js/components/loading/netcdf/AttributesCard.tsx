'use client';
import React from 'react';
import { Info, ChevronRight, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AttributesCardProps {
  attributes: Record<string, unknown>;
  expanded: boolean;
  onToggle: () => void;
}

export const AttributesCard = ({ attributes, expanded, onToggle }: AttributesCardProps) => {
  if (Object.keys(attributes).length === 0) return null;

  return (
    <Card className="border-0 py-0">
      <button onClick={onToggle} className="w-full">
        <CardHeader className="hover:bg-accent/50 transition-colors cursor-pointer p-2 sm:p-3">
          <CardTitle className="text-base flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Info className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Attributes ({Object.keys(attributes).length})</span>
            </div>
            {expanded ? (
              <ChevronDown className="h-4 w-4 flex-shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 flex-shrink-0" />
            )}
          </CardTitle>
        </CardHeader>
      </button>

      {expanded && (
        <CardContent className="p-2 sm:p-3 pt-0">
          <div className="max-h-[300px] overflow-y-auto space-y-1 text-xs overflow-x-auto">
            {Object.entries(attributes).map(([k, v]) => (
              <div
                key={k}
                className="flex flex-col sm:grid sm:grid-cols-[minmax(100px,auto)_1fr] gap-0.5 sm:gap-2 min-w-0"
              >
                <span className="font-mono text-muted-foreground break-words">{k}:</span>
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
        </CardContent>
      )}
    </Card>
  );
};
