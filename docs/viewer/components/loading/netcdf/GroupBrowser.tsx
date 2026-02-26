'use client';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { DataTree, GroupNode } from '@earthyscience/netcdf4-wasm';

export const ROOT_VARS_KEY = '/__root_vars__';

interface GroupBrowserTriggerProps {
  showGroupMenu: boolean;
  onToggleMenu: () => void;
}

interface GroupBrowserPanelProps {
  tree: DataTree;
  currentGroupPath: string;
  expandedGroups: Set<string>;
  onToggleExpand: (path: string) => void;
  onVariableClick: (varName: string, groupPath: string) => void;
}

export const GroupBrowserTrigger = ({ showGroupMenu, onToggleMenu }: GroupBrowserTriggerProps) => (
  <Button
    variant="outline"
    size="sm"
    onClick={onToggleMenu}
    className="cursor-pointer flex-shrink-0"
  >
    <FolderOpen className="h-4 w-4 mr-2" />
    <span className="hidden sm:inline">Browse Groups</span>
    <span className="sm:hidden">Groups</span>
    {showGroupMenu ? (
      <ChevronDown className="h-3 w-3 ml-1" />
    ) : (
      <ChevronRight className="h-3 w-3 ml-1" />
    )}
  </Button>
);

export const GroupBrowserPanel = ({
  tree,
  currentGroupPath,
  expandedGroups,
  onToggleExpand,
  onVariableClick,
}: GroupBrowserPanelProps) => {
  const groupTree = tree.buildGroupTree();

  const renderGroupItem = (node: GroupNode, level: number = 0) => {
    const isSelected = node.path === currentGroupPath;
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedGroups.has(node.path);
    const groupVars = tree.getAllVariables(node.path);
    const varNames = Object.keys(groupVars);

    return (
      <div key={node.path}>
        <div className="flex items-stretch gap-1" style={{ paddingLeft: `${level * 12}px` }}>
          <button
            onClick={() => onToggleExpand(node.path)}
            className={`flex-1 text-left px-2 py-2 rounded text-sm flex items-center justify-between gap-2 hover:bg-accent/50 ${
              isSelected ? 'bg-accent font-semibold' : ''
            }`}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {hasChildren || varNames.length > 0 ? (
                isExpanded ? (
                  <ChevronDown className="h-3 w-3 flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-3 w-3 flex-shrink-0" />
                )
              ) : (
                <div className="w-3 h-3 flex-shrink-0" />
              )}
              {hasChildren ? (
                <FolderOpen className="h-4 w-4 flex-shrink-0" />
              ) : (
                <Folder className="h-4 w-4 flex-shrink-0" />
              )}
              <span className="truncate">{node.name}</span>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              {node.variableCount > 0 && (
                <Badge variant="secondary" className="text-xs h-5">
                  {node.variableCount}
                </Badge>
              )}
              {hasChildren && (
                <Badge variant="outline" className="text-xs h-5">
                  {node.children.length}
                </Badge>
              )}
            </div>
          </button>
        </div>

        {isExpanded && varNames.length > 0 && (
          <div style={{ paddingLeft: `${(level + 1) * 12 + 20}px` }} className="space-y-0.5 py-1">
            {varNames.map((name) => (
              <button
                key={name}
                onClick={() => onVariableClick(name, node.path)}
                className="w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 hover:bg-accent/50 text-muted-foreground"
              >
                <FileText className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{name}</span>
              </button>
            ))}
          </div>
        )}

        {isExpanded && hasChildren && (
          <div>{node.children.map((child) => renderGroupItem(child, level + 1))}</div>
        )}
      </div>
    );
  };

  const rootVars = tree.getAllVariables('/');
  const rootVarNames = Object.keys(rootVars);
  const isRootExpanded = expandedGroups.has('/');
  const isRootVarsExpanded = expandedGroups.has(ROOT_VARS_KEY);

  return (
    <div className="border rounded-md p-2 max-h-[400px] overflow-y-auto bg-card">
      {/* Root row */}
      <div className="flex items-stretch gap-1">
        <button
          onClick={() => onToggleExpand('/')}
          className={`flex-1 text-left px-2 py-2 rounded text-sm flex items-center justify-between gap-2 hover:bg-accent/50 ${
            currentGroupPath === '/' ? 'bg-accent font-semibold' : ''
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {groupTree.children.length > 0 || rootVarNames.length > 0 ? (
              isRootExpanded ? (
                <ChevronDown className="h-3 w-3 flex-shrink-0" />
              ) : (
                <ChevronRight className="h-3 w-3 flex-shrink-0" />
              )
            ) : (
              <div className="w-3 h-3 flex-shrink-0" />
            )}
            <Folder className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">/ (root)</span>
          </div>
          {groupTree.variableCount > 0 && (
            <Badge variant="secondary" className="text-xs h-5 flex-shrink-0">
              {groupTree.variableCount}
            </Badge>
          )}
        </button>
      </div>

      {/* Root variables (collapsible section) */}
      {isRootExpanded && rootVarNames.length > 0 && (
        <div style={{ paddingLeft: '12px' }}>
          <button
            onClick={() => onToggleExpand(ROOT_VARS_KEY)}
            className="w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 hover:bg-accent/50 text-muted-foreground"
          >
            {isRootVarsExpanded ? (
              <ChevronDown className="h-3 w-3 flex-shrink-0" />
            ) : (
              <ChevronRight className="h-3 w-3 flex-shrink-0" />
            )}
            <span className="truncate">Variables ({rootVarNames.length})</span>
          </button>

          {isRootVarsExpanded && (
            <div style={{ paddingLeft: '20px' }} className="space-y-0.5 py-1">
              {rootVarNames.map((name) => (
                <button
                  key={name}
                  onClick={() => onVariableClick(name, '/')}
                  className="w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 hover:bg-accent/50 text-muted-foreground"
                >
                  <FileText className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Child groups */}
      {isRootExpanded && groupTree.children.map((child) => renderGroupItem(child, 0))}
    </div>
  );
};