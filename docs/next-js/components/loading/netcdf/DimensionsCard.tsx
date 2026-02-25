'use client';
import React from 'react';
import { Info, ChevronRight, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dimension } from './types';

interface DimensionsCardProps {
  dimensions: Record<string, Dimension>;
  expanded: boolean;
  onToggle: () => void;
}

export const DimensionsCard = ({ dimensions, expanded, onToggle }: DimensionsCardProps) => {
  if (Object.keys(dimensions).length === 0) return null;

  return (
    <Card className="border-0 py-0">
      <button onClick={onToggle} className="w-full">
        <CardHeader className="hover:bg-accent/50 transition-colors cursor-pointer p-2 sm:p-3">
          <CardTitle className="text-base flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Info className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Dimensions ({Object.keys(dimensions).length})</span>
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
          <div className="space-y-1 text-xs overflow-x-auto">
            {Object.entries(dimensions).map(([name, dim]) => (
              <div
                key={name}
                className="flex flex-col sm:grid sm:grid-cols-[minmax(100px,auto)_1fr] gap-0.5 sm:gap-2 min-w-0"
              >
                <span className="font-mono text-muted-foreground">{name}:</span>
                <span className="font-mono break-all pl-4 sm:pl-0">
                  {dim.size || dim.len || dim.length || 'unlimited'}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
};
