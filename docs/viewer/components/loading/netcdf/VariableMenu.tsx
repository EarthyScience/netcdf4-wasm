'use client';
import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { FileText, ChevronRight, ChevronDown } from 'lucide-react';
import { VariableData } from './types';

interface VariableMenuTriggerProps {
  showVariableMenu: boolean;
  onToggle: () => void;
}

interface VariableMenuPanelProps {
  variables: Record<string, VariableData>;
  selectedVariable: string | null;
  onSelect: (name: string) => void;
}

export const VariableMenuTrigger = ({ showVariableMenu, onToggle }: VariableMenuTriggerProps) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="outline"
        size="sm"
        onClick={onToggle}
        className="cursor-pointer flex-shrink-0"
      >
        <FileText className="h-4 w-4 mr-2" />
        <span className="hidden sm:inline">Select Variable</span>
        <span className="sm:hidden">Variables</span>
        {showVariableMenu ? (
          <ChevronDown className="h-3 w-3 ml-1" />
        ) : (
          <ChevronRight className="h-3 w-3 ml-1" />
        )}
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>Variables in current group</p>
    </TooltipContent>
  </Tooltip>
);

export const VariableMenuPanel = ({
  variables,
  selectedVariable,
  onSelect,
}: VariableMenuPanelProps) => {
  const varNames = Object.keys(variables);
  if (varNames.length === 0) return null;

  return (
    <div className="border rounded-md p-2 max-h-[300px] overflow-y-auto bg-card">
      {varNames.map((name) => (
        <button
          key={name}
          onClick={() => onSelect(name)}
          className={`w-full text-left px-2 py-2 rounded text-sm flex items-center gap-2 ${
            selectedVariable === name ? 'bg-accent font-semibold' : 'hover:bg-accent/50'
          }`}
        >
          <FileText className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">{name}</span>
        </button>
      ))}
    </div>
  );
};