'use client';

import React, { ChangeEvent, useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Terminal, 
  Folder, 
  FolderOpen, 
  FileText,
  Info,
  Search,
  ChevronRight,
  ChevronDown,
  Database
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Card,
  CardContent,
  // CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { NetCDF4, DataTree, GroupNode } from '@earthyscience/netcdf4-wasm';
import BrowzarrCTA from './BrowzarrCTA';

const NETCDF_EXT_REGEX = /\.(nc|netcdf|nc3|nc4)$/i;

interface VariableData {
  name: string;
  info?: any;
  data?: any;
}

const LocalNetCDFMeta = () => {
  const [tree, setTree] = useState<DataTree | null>(null);
  const [dataset, setDataset] = useState<any>(null);

  const [currentGroupPath, setCurrentGroupPath] = useState<string>('/');
  const [variables, setVariables] = useState<Record<string, VariableData>>({});
  const [attributes, setAttributes] = useState<Record<string, unknown>>({});
  const [dimensions, setDimensions] = useState<Record<string, any>>({});

  const [selectedVariable, setSelectedVariable] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{name: string; groupPath: string}>>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [pendingVariableLoad, setPendingVariableLoad] = useState<{name: string; groupPath: string} | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingVariable, setLoadingVariable] = useState<string | null>(null);

  // Expand/collapse state
  const [expandedVariableInfo, setExpandedVariableInfo] = useState(true);
  const [expandedVariableAttrs, setExpandedVariableAttrs] = useState(true);
  const [expandedDimensions, setExpandedDimensions] = useState(true);
  const [expandedAttributes, setExpandedAttributes] = useState(true);

  // Mobile menu states
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [showVariableMenu, setShowVariableMenu] = useState(false);
  const [expandedMobileGroups, setExpandedMobileGroups] = useState<Set<string>>(new Set(['/']));

  // Hover state for showing variables
  const [hoveredGroupPath, setHoveredGroupPath] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const refreshGroup = (path: string, dataTree: DataTree) => {
    setCurrentGroupPath(path);
    setVariables(dataTree.getAllVariables(path));
    setAttributes(dataTree.getAttributes(path));
    setDimensions(dataTree.getDimensions(path));
    setSelectedVariable(null);
  };

  // Handle pending variable loads after group change
  useEffect(() => {
    if (pendingVariableLoad && currentGroupPath === pendingVariableLoad.groupPath) {
      setSelectedVariable(pendingVariableLoad.name);
      if (variables[pendingVariableLoad.name] && !variables[pendingVariableLoad.name].info) {
        loadVariableInfo(pendingVariableLoad.name);
      }
      setPendingVariableLoad(null);
    }
  }, [currentGroupPath, variables, pendingVariableLoad]);

  const formatDataPreview = (data: any, maxItems = 20) => {
    if (!data) return 'No data';
    const arr = Array.isArray(data) ? data : Array.from(data);
    const preview = arr.slice(0, maxItems).map((v) =>
      typeof v === 'number' ? v.toFixed(4) : String(v)
    );
    const suffix = arr.length > maxItems ? `, ... (${arr.length} total)` : '';
    return `[${preview.join(', ')}${suffix}]`;
  };

  // ---------------------------------------------------------------------------
  // Recursive component for nested menu items
  // ---------------------------------------------------------------------------

  const GroupMenuItem: React.FC<{ 
    node: GroupNode; 
    onSelect: (path: string) => void;
    currentPath: string;
  }> = ({ node, onSelect, currentPath }) => {
    const hasChildren = node.children.length > 0;
    const isSelected = node.path === currentPath;
    const groupVariables = tree ? tree.getAllVariables(node.path) : {};
    const variableNames = Object.keys(groupVariables);
    const showVariables = hoveredGroupPath === node.path && variableNames.length > 0;

    const handleVariableClick = (varName: string) => {
      // Navigate to the group first if not already there
      if (currentGroupPath !== node.path) {
        onSelect(node.path);
      }
      // Set as pending so it loads after group change
      setPendingVariableLoad({ name: varName, groupPath: node.path });
    };

    if (!hasChildren) {
      return (
        <div 
          onMouseEnter={() => setHoveredGroupPath(node.path)}
          onMouseLeave={() => setHoveredGroupPath(null)}
        >
          <DropdownMenuItem 
            onClick={() => onSelect(node.path)}
            className={`cursor-pointer ${isSelected ? 'bg-accent' : ''}`}
          >
            <Folder className="h-4 w-4 mr-2 flex-shrink-0" />
            <div className="flex items-center justify-between flex-1 min-w-0 gap-2">
              <span className="truncate">{node.name}</span>
              <div className="flex gap-1 flex-shrink-0">
                {node.variableCount > 0 && (
                  <Badge variant="secondary" className="text-xs h-5">
                    {node.variableCount} vars
                  </Badge>
                )}
              </div>
            </div>
          </DropdownMenuItem>
          {showVariables && (
            <div className="px-4 py-1 text-xs bg-muted/50 space-y-0.5">
              {variableNames.slice(0, 5).map(name => (
                <button
                  key={name}
                  onClick={() => handleVariableClick(name)}
                  className="w-full text-left truncate py-1 px-2 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                >
                  <FileText className="h-3 w-3 inline mr-1" />
                  {name}
                </button>
              ))}
              {variableNames.length > 5 && (
                <div className="py-1 px-2 text-muted-foreground">... +{variableNames.length - 5} more</div>
              )}
            </div>
          )}
        </div>
      );
    }

    return (
      <DropdownMenuSub>
        <div
          onMouseEnter={() => setHoveredGroupPath(node.path)}
          onMouseLeave={() => setHoveredGroupPath(null)}
        >
          <DropdownMenuSubTrigger className={`cursor-pointer ${isSelected ? 'bg-accent' : ''}`}>
            <FolderOpen className="h-4 w-4 mr-2 flex-shrink-0" />
            <div className="flex items-center justify-between flex-1 min-w-0 gap-2">
              <span className="truncate">{node.name}</span>
              <div className="flex gap-1 flex-shrink-0">
                {node.variableCount > 0 && (
                  <Badge variant="secondary" className="text-xs h-5">
                    {node.variableCount}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs h-5">
                  {node.children.length}
                </Badge>
              </div>
            </div>
          </DropdownMenuSubTrigger>
          {showVariables && (
            <div className="px-4 py-1 text-xs bg-muted/50 space-y-0.5">
              {variableNames.slice(0, 5).map(name => (
                <button
                  key={name}
                  onClick={() => handleVariableClick(name)}
                  className="w-full text-left truncate py-1 px-2 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                >
                  <FileText className="h-3 w-3 inline mr-1" />
                  {name}
                </button>
              ))}
              {variableNames.length > 5 && (
                <div className="py-1 px-2 text-muted-foreground">... +{variableNames.length - 5} more</div>
              )}
            </div>
          )}
        </div>
        <DropdownMenuSubContent>
          <DropdownMenuItem 
            onClick={() => onSelect(node.path)}
            className={`cursor-pointer ${isSelected ? 'bg-accent font-semibold' : ''}`}
          >
            <Folder className="h-4 w-4 mr-2 flex-shrink-0" />
            (Select this group)
          </DropdownMenuItem>
          {node.children.length > 0 && <DropdownMenuSeparator />}
          {node.children.map((child) => (
            <GroupMenuItem
              key={child.path}
              node={child}
              onSelect={onSelect}
              currentPath={currentPath}
            />
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    );
  };

  // ---------------------------------------------------------------------------
  // File / URL loading
  // ---------------------------------------------------------------------------

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    if (!NETCDF_EXT_REGEX.test(file.name)) {
      setError('Please select a valid NetCDF file.');
      return;
    }

    try {
      setIsLoading(true);

      const ds = await NetCDF4.fromBlobLazy(file);
      const dt = new DataTree(ds);
      await dt.buildTree();

      setDataset(ds);
      setTree(dt);

      refreshGroup('/', dt);
    } catch (err) {
      console.error(err);
      setError('Failed to load NetCDF file.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUrlFetch = async () => {
    setError(null);

    if (!NETCDF_EXT_REGEX.test(url)) {
      setError('URL should point to a NetCDF file.');
      return;
    }

    try {
      setIsLoading(true);

      const ds = await NetCDF4.Dataset(url);
      const dt = new DataTree(ds);
      await dt.buildTree();

      setDataset(ds);
      setTree(dt);

      refreshGroup('/', dt);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch NetCDF.');
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Group navigation
  // ---------------------------------------------------------------------------

  const selectGroup = (path: string) => {
    if (!tree) return;
    refreshGroup(path, tree);
  };

  // ---------------------------------------------------------------------------
  // Variable handling
  // ---------------------------------------------------------------------------

  const loadVariableInfo = async (varName: string) => {
    if (!dataset) return;

    setLoadingVariable(varName);

    try {
      const info = await dataset.getVariableInfo(
        varName,
        currentGroupPath === '/' ? undefined : currentGroupPath
      );

      setVariables((prev) => ({
        ...prev,
        [varName]: { ...prev[varName], info },
      }));
    } finally {
      setLoadingVariable(null);
    }
  };

  const loadVariableData = async (varName: string) => {
    if (!dataset) return;

    setLoadingVariable(varName);

    try {
      const data = await dataset.getVariableArray(
        varName,
        currentGroupPath === '/' ? undefined : currentGroupPath
      );

      setVariables((prev) => ({
        ...prev,
        [varName]: { ...prev[varName], data },
      }));
    } finally {
      setLoadingVariable(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Search functionality
  // ---------------------------------------------------------------------------

  const handleSearch = () => {
    if (!tree || !searchQuery.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    const results = tree.searchVariables(searchQuery);
    setSearchResults(results);
    setShowSearchResults(true);
  };

  const handleSearchInputChange = (value: string) => {
    setSearchQuery(value);
    if (!value.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    // Show partial matches while typing
    if (tree) {
      const results = tree.searchVariables(value);
      setSearchResults(results);
      setShowSearchResults(true);
    }
  };

  const selectSearchResult = (result: {name: string; groupPath: string}) => {
    setPendingVariableLoad(result);
    selectGroup(result.groupPath);
    setShowSearchResults(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------

  const breadcrumbs = tree ? tree.getBreadcrumbs(currentGroupPath) : [];
  const groupSummary = tree ? tree.getGroupSummary(currentGroupPath) : null;
  const datasetSummary = tree ? tree.getDatasetSummary() : null;

  return (
    <div className="w-full max-w-4xl mx-auto px-2 sm:px-4 py-0 space-y-3 sm:space-y-4">      

      {/* File Upload */}
      <Input
        id="netcdf-file"
        type="file"
        onChange={handleFileSelect}
        disabled={isLoading}
        className="cursor-pointer w-full"
      />
      
      {datasetSummary && (
        <div className="flex gap-2 justify-center text-xs text-muted-foreground flex-wrap">
          <span>{datasetSummary.totalGroups} groups</span>
          <span>•</span>
          <span>{datasetSummary.totalVariables} variables</span>
          <span>•</span>
          <span>{datasetSummary.totalDimensions} dimensions</span>
        </div>
      )}

      {/* URL Fetch */}
      <Field>
        <ButtonGroup className="w-full">
          <Input
            placeholder="http:// or https://"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isLoading}
            className="min-w-0"
          />
          <Button variant="outline" onClick={handleUrlFetch} disabled={isLoading} className="flex-shrink-0">
            Fetch
          </Button>
        </ButtonGroup>

        {isLoading && (
          <div className="flex items-center gap-2 mt-2">
            <Spinner />
            <span className="text-sm text-muted-foreground">Loading...</span>
          </div>
        )}
      </Field>

      {error && (
        <Alert variant="destructive">
          <Terminal className="h-4 w-4 flex-shrink-0" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="break-words">{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      {tree && (
        <div className="space-y-3 sm:space-y-4">
          {/* Navigation Bar */}
          <Card className='border-0'>
            <CardContent className="space-y-3 p-3 sm:p-6">
              {/* Controls */}
              <div className="flex gap-2 flex-wrap">
                {/* Group Browser */}
                <div className="flex-shrink-0">
                  {/* Desktop: Dropdown Menu */}
                  <div className="hidden sm:block">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="cursor-pointer flex-shrink-0">
                          <FolderOpen className="h-4 w-4 mr-2" />
                          Browse Groups
                        </Button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent className="max-h-[400px] overflow-y-auto w-56 sm:w-64">
                        {(() => {
                          const groupTree = tree.buildGroupTree();
                          const rootVars = tree.getAllVariables('/');
                          const rootVarNames = Object.keys(rootVars);
                          const showRootVariables = hoveredGroupPath === '/' && rootVarNames.length > 0;

                          const handleRootVariableClick = (varName: string) => {
                            if (currentGroupPath !== '/') {
                              selectGroup('/');
                            }
                            setPendingVariableLoad({ name: varName, groupPath: '/' });
                          };

                          return (
                            <>
                              <div
                                onMouseEnter={() => setHoveredGroupPath('/')}
                                onMouseLeave={() => setHoveredGroupPath(null)}
                              >
                                <DropdownMenuItem 
                                  onClick={() => selectGroup('/')}
                                  className={`cursor-pointer ${currentGroupPath === '/' ? 'bg-accent font-semibold' : ''}`}
                                >
                                  <Folder className="h-4 w-4 mr-2 flex-shrink-0" />
                                  <div className="flex items-center justify-between flex-1 min-w-0 gap-2">
                                    <span className="truncate">/ (root)</span>
                                    {groupTree.variableCount > 0 && (
                                      <Badge variant="secondary" className="text-xs h-5 flex-shrink-0">
                                        {groupTree.variableCount}
                                      </Badge>
                                    )}
                                  </div>
                                </DropdownMenuItem>
                                {showRootVariables && (
                                  <div className="px-4 py-1 text-xs bg-muted/50 space-y-0.5">
                                    {rootVarNames.slice(0, 5).map(name => (
                                      <button
                                        key={name}
                                        onClick={() => handleRootVariableClick(name)}
                                        className="w-full text-left truncate py-1 px-2 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                                      >
                                        <FileText className="h-3 w-3 inline mr-1" />
                                        {name}
                                      </button>
                                    ))}
                                    {rootVarNames.length > 5 && (
                                      <div className="py-1 px-2 text-muted-foreground">... +{rootVarNames.length - 5} more</div>
                                    )}
                                  </div>
                                )}
                              </div>
                              {groupTree.children.length > 0 && <DropdownMenuSeparator />}
                              {groupTree.children.map((child) => (
                                <GroupMenuItem
                                  key={child.path}
                                  node={child}
                                  onSelect={selectGroup}
                                  currentPath={currentGroupPath}
                                />
                              ))}
                            </>
                          );
                        })()}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Mobile: Expandable Menu */}
                  <div className="sm:hidden">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setShowGroupMenu(!showGroupMenu)}
                      className="cursor-pointer flex-shrink-0"
                    >
                      <FolderOpen className="h-4 w-4 mr-2" />
                      Groups
                      {showGroupMenu ? (
                        <ChevronDown className="h-3 w-3 ml-1" />
                      ) : (
                        <ChevronRight className="h-3 w-3 ml-1" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Variable Selector */}
                {Object.keys(variables).length > 0 && (
                  <div className="flex-shrink-0">
                    {/* Desktop: Dropdown Menu */}
                    <div className="hidden sm:block">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="cursor-pointer flex-shrink-0">
                            <FileText className="h-4 w-4 mr-2" />
                            Select Variable
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="max-h-[300px] overflow-y-auto w-56 sm:w-64">
                          {Object.keys(variables).map((name) => (
                            <DropdownMenuItem
                              key={name}
                              onClick={() => {
                                setSelectedVariable(name);
                                if (!variables[name].info) loadVariableInfo(name);
                              }}
                              className="cursor-pointer"
                            >
                              <FileText className="h-3 w-3 mr-2 flex-shrink-0" />
                              <span className="truncate">{name}</span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Mobile: Expandable Menu */}
                    <div className="sm:hidden">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setShowVariableMenu(!showVariableMenu)}
                        className="cursor-pointer flex-shrink-0"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Variables
                        {showVariableMenu ? (
                          <ChevronDown className="h-3 w-3 ml-1" />
                        ) : (
                          <ChevronRight className="h-3 w-3 ml-1" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Search */}
                <div className="flex gap-1 flex-1 min-w-[180px] sm:min-w-[200px] relative">
                  <Input
                    placeholder="Search variables..."
                    value={searchQuery}
                    onChange={(e) => handleSearchInputChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
                    className="h-9 text-sm min-w-0"
                  />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleSearch}
                    disabled={!searchQuery.trim()}
                    className="flex-shrink-0"
                  >
                    <Search className="h-4 w-4" />
                  </Button>

                  {/* Search Results Dropdown */}
                  {showSearchResults && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setShowSearchResults(false)}
                      />
                      <div className="absolute top-full left-0 right-0 sm:right-12 mt-1 bg-popover border rounded-md shadow-md max-h-[300px] overflow-y-auto z-20">
                        {searchResults.length > 0 ? (
                          <div className="py-1">
                            {searchResults.map((result, idx) => (
                              <button
                                key={`${result.groupPath}-${result.name}-${idx}`}
                                onClick={() => selectSearchResult(result)}
                                className="w-full text-left px-3 py-2 hover:bg-accent cursor-pointer transition-colors"
                              >
                                <div className="flex items-start gap-2">
                                  <FileText className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-mono text-sm break-all">
                                      {result.name}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-0.5 break-all">
                                      {result.groupPath}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                            No variables found matching your search.
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Mobile Group Menu (Expanded) */}
              {showGroupMenu && (
                <div className="sm:hidden border rounded-md p-2 max-h-[400px] overflow-y-auto bg-card">
                  {(() => {
                    const groupTree = tree.buildGroupTree();
                    
                    const toggleGroup = (path: string) => {
                      const newExpanded = new Set(expandedMobileGroups);
                      if (newExpanded.has(path)) {
                        newExpanded.delete(path);
                      } else {
                        newExpanded.add(path);
                      }
                      setExpandedMobileGroups(newExpanded);
                    };

                    const handleMobileVariableClick = (varName: string, groupPath: string) => {
                      if (currentGroupPath !== groupPath) {
                        selectGroup(groupPath);
                      }
                      setPendingVariableLoad({ name: varName, groupPath });
                      setShowGroupMenu(false);
                    };

                    const renderGroupItem = (node: GroupNode, level: number = 0) => {
                      const isSelected = node.path === currentGroupPath;
                      const hasChildren = node.children.length > 0;
                      const isExpanded = expandedMobileGroups.has(node.path);
                      const groupVars = tree.getAllVariables(node.path);
                      const varNames = Object.keys(groupVars);

                      return (
                        <div key={node.path}>
                          <div className="flex items-stretch gap-1" style={{ paddingLeft: `${level * 12}px` }}>
                            {/* Expand/Collapse button for groups with children or variables */}
                            {(hasChildren || varNames.length > 0) && (
                              <button
                                onClick={() => toggleGroup(node.path)}
                                className="px-1 hover:bg-accent/50 rounded flex items-center"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-3 w-3" />
                                ) : (
                                  <ChevronRight className="h-3 w-3" />
                                )}
                              </button>
                            )}
                            
                            {/* Group button */}
                            <button
                              onClick={() => {
                                selectGroup(node.path);
                                setShowGroupMenu(false);
                              }}
                              className={`flex-1 text-left px-2 py-2 rounded text-sm flex items-center justify-between gap-2 ${
                                isSelected ? 'bg-accent font-semibold' : 'hover:bg-accent/50'
                              } ${!(hasChildren || varNames.length > 0) ? 'ml-5' : ''}`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
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

                          {/* Variables for this group (when expanded) */}
                          {isExpanded && varNames.length > 0 && (
                            <div style={{ paddingLeft: `${(level + 1) * 12 + 20}px` }} className="space-y-0.5 py-1">
                              {varNames.map(name => (
                                <button
                                  key={name}
                                  onClick={() => handleMobileVariableClick(name, node.path)}
                                  className="w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 hover:bg-accent/50 text-muted-foreground"
                                >
                                  <FileText className="h-3 w-3 flex-shrink-0" />
                                  <span className="truncate">{name}</span>
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Child groups (when expanded) */}
                          {isExpanded && hasChildren && (
                            <div>
                              {node.children.map(child => renderGroupItem(child, level + 1))}
                            </div>
                          )}
                        </div>
                      );
                    };

                    // Root group handling
                    const rootVars = tree.getAllVariables('/');
                    const rootVarNames = Object.keys(rootVars);
                    const isRootExpanded = expandedMobileGroups.has('/');

                    return (
                      <>
                        <div className="flex items-stretch gap-1">
                          {/* Expand/Collapse button for root */}
                          {(groupTree.children.length > 0 || rootVarNames.length > 0) && (
                            <button
                              onClick={() => toggleGroup('/')}
                              className="px-1 hover:bg-accent/50 rounded flex items-center"
                            >
                              {isRootExpanded ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronRight className="h-3 w-3" />
                              )}
                            </button>
                          )}
                          
                          <button
                            onClick={() => {
                              selectGroup('/');
                              setShowGroupMenu(false);
                            }}
                            className={`flex-1 text-left px-2 py-2 rounded text-sm flex items-center justify-between gap-2 ${
                              currentGroupPath === '/' ? 'bg-accent font-semibold' : 'hover:bg-accent/50'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
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

                        {/* Root variables (when expanded) */}
                        {isRootExpanded && rootVarNames.length > 0 && (
                          <div style={{ paddingLeft: '32px' }} className="space-y-0.5 py-1">
                            {rootVarNames.map(name => (
                              <button
                                key={name}
                                onClick={() => handleMobileVariableClick(name, '/')}
                                className="w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 hover:bg-accent/50 text-muted-foreground"
                              >
                                <FileText className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{name}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Root child groups (when expanded) */}
                        {isRootExpanded && groupTree.children.map(child => renderGroupItem(child, 0))}
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Mobile Variable Menu (Expanded) */}
              {showVariableMenu && Object.keys(variables).length > 0 && (
                <div className="sm:hidden border rounded-md p-2 max-h-[300px] overflow-y-auto bg-card">
                  {Object.keys(variables).map((name) => (
                    <button
                      key={name}
                      onClick={() => {
                        setSelectedVariable(name);
                        if (!variables[name].info) loadVariableInfo(name);
                        setShowVariableMenu(false);
                      }}
                      className={`w-full text-left px-2 py-2 rounded text-sm flex items-center gap-2 ${
                        selectedVariable === name ? 'bg-accent font-semibold' : 'hover:bg-accent/50'
                      }`}
                    >
                      <FileText className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{name}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Group Summary */}
              {groupSummary && (
                <div className="flex gap-2 sm:gap-3 text-xs flex-wrap">
                  <Badge variant="outline" className="flex-shrink-0">
                    {groupSummary.variableCount} variables
                  </Badge>
                  <Badge variant="outline" className="flex-shrink-0">
                    {groupSummary.dimensionCount} dimensions
                  </Badge>
                  <Badge variant="outline" className="flex-shrink-0">
                    {groupSummary.attributeCount} attributes
                  </Badge>
                  {groupSummary.subgroupCount > 0 && (
                    <Badge variant="outline" className="flex-shrink-0">
                      {groupSummary.subgroupCount} subgroups
                    </Badge>
                  )}
                </div>
              )}

              {/* Breadcrumbs */}
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <div className="flex items-center gap-1 text-muted-foreground flex-wrap">
                  {breadcrumbs.map((crumb, idx) => (
                    <React.Fragment key={crumb.path}>
                      <button
                        onClick={() => selectGroup(crumb.path)}
                        className={`hover:text-foreground transition-colors cursor-pointer break-all ${
                          crumb.path === currentGroupPath ? 'text-foreground font-semibold' : ''
                        }`}
                      >
                        {crumb.name}
                      </button>
                      {idx < breadcrumbs.length - 1 && (
                        <ChevronRight className="h-3 w-3 flex-shrink-0" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
                
                {selectedVariable && (
                  <Badge 
                    className="text-xs h-5 max-w-full"
                    style={{ backgroundColor: '#644FF0', color: 'white' }}
                  >
                    <FileText className="h-3 w-3 mr-1 flex-shrink-0" />
                    <span className="truncate">{selectedVariable}</span>
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Variable Details */}
          {selectedVariable && variables[selectedVariable] && (
            <Card className="border-0">
              <CardContent className="space-y-3 p-3 sm:p-6">
                {loadingVariable === selectedVariable && (
                  <div className="flex items-center gap-2">
                    <Spinner className="h-4 w-4" />
                    <span className="text-sm text-muted-foreground">Loading...</span>
                  </div>
                )}

                {variables[selectedVariable].info && (
                  <div className="space-y-2">
                    {/* Collapsible Variable Info */}
                    <div className="border-[0.1px] rounded-lg overflow-hidden">
                      <button
                        onClick={() => setExpandedVariableInfo(!expandedVariableInfo)}
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
                        <div className="px-3 pb-3 space-y-2 sm:space-y-1 text-xs overflow-x-auto">
                          {/* Name */}
                          <div className="flex flex-col sm:grid sm:grid-cols-[150px_1fr] gap-0.5 sm:gap-2 min-w-0">
                            <span className="font-mono text-muted-foreground">name:</span>
                            <span className="font-mono break-all">
                              {variables[selectedVariable].info.name}
                            </span>
                          </div>

                          {/* Data Type */}
                          <div className="flex flex-col sm:grid sm:grid-cols-[150px_1fr] gap-0.5 sm:gap-2 min-w-0">
                            <span className="font-mono text-muted-foreground">dtype:</span>
                            <span className="font-mono break-all">
                              {variables[selectedVariable].info.dtype}
                            </span>
                          </div>

                          {/* NC Type */}
                          {variables[selectedVariable].info.nctype !== undefined && (
                            <div className="flex flex-col sm:grid sm:grid-cols-[150px_1fr] gap-0.5 sm:gap-2 min-w-0">
                              <span className="font-mono text-muted-foreground">nctype:</span>
                              <span className="font-mono break-all">
                                {variables[selectedVariable].info.nctype}
                              </span>
                            </div>
                          )}

                          {/* Shape */}
                          <div className="flex flex-col sm:grid sm:grid-cols-[150px_1fr] gap-0.5 sm:gap-2 min-w-0">
                            <span className="font-mono text-muted-foreground">shape:</span>
                            <span className="font-mono break-all">
                              [{variables[selectedVariable].info.shape.join(', ')}]
                            </span>
                          </div>

                          {/* Dimensions */}
                          <div className="flex flex-col sm:grid sm:grid-cols-[150px_1fr] gap-0.5 sm:gap-2 min-w-0">
                            <span className="font-mono text-muted-foreground">dimensions:</span>
                            <span className="font-mono break-all">
                              [{variables[selectedVariable].info.dimensions?.join(', ') || 'N/A'}]
                            </span>
                          </div>

                          {/* Size */}
                          <div className="flex flex-col sm:grid sm:grid-cols-[150px_1fr] gap-0.5 sm:gap-2 min-w-0">
                            <span className="font-mono text-muted-foreground">size:</span>
                            <span className="font-mono break-all">
                              {variables[selectedVariable].info.size.toLocaleString()}
                            </span>
                          </div>

                          {/* Total Size */}
                          {variables[selectedVariable].info.totalSize !== undefined && (
                            <div className="flex flex-col sm:grid sm:grid-cols-[150px_1fr] gap-0.5 sm:gap-2 min-w-0">
                              <span className="font-mono text-muted-foreground">totalSize:</span>
                              <span className="font-mono break-all">
                                {variables[selectedVariable].info.totalSize.toLocaleString()} bytes
                              </span>
                            </div>
                          )}

                          {/* Chunked */}
                          {variables[selectedVariable].info.chunked !== undefined && (
                            <div className="flex flex-col sm:grid sm:grid-cols-[150px_1fr] gap-0.5 sm:gap-2 min-w-0">
                              <span className="font-mono text-muted-foreground">chunked:</span>
                              <span className="font-mono break-all">
                                {String(variables[selectedVariable].info.chunked)}
                              </span>
                            </div>
                          )}

                          {/* Chunks */}
                          {variables[selectedVariable].info.chunks && (
                            <div className="flex flex-col sm:grid sm:grid-cols-[150px_1fr] gap-0.5 sm:gap-2 min-w-0">
                              <span className="font-mono text-muted-foreground">chunks:</span>
                              <span className="font-mono break-all">
                                [{variables[selectedVariable].info.chunks.join(', ')}]
                              </span>
                            </div>
                          )}

                          {/* Chunk Size */}
                          {variables[selectedVariable].info.chunkSize !== undefined && (
                            <div className="flex flex-col sm:grid sm:grid-cols-[150px_1fr] gap-0.5 sm:gap-2 min-w-0">
                              <span className="font-mono text-muted-foreground">chunkSize:</span>
                              <span className="font-mono break-all">
                                {variables[selectedVariable].info.chunkSize.toLocaleString()} bytes
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Collapsible Variable Attributes */}
                    {variables[selectedVariable].info.attributes && 
                     Object.keys(variables[selectedVariable].info.attributes).length > 0 && (
                      <div className="border-0 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setExpandedVariableAttrs(!expandedVariableAttrs)}
                          className="w-full flex items-center justify-between p-3 hover:bg-accent/50 transition-colors cursor-pointer"
                        >
                          <span className="text-sm font-semibold truncate">
                            Variable Attributes ({Object.keys(variables[selectedVariable].info.attributes).length})
                          </span>
                          {expandedVariableAttrs ? (
                            <ChevronDown className="h-4 w-4 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 flex-shrink-0" />
                          )}
                        </button>
                        
                        {expandedVariableAttrs && (
                          <div className="px-3 pb-3 space-y-2 sm:space-y-1 text-xs overflow-x-auto">
                            {Object.entries(variables[selectedVariable].info.attributes).map(([k, v]) => (
                              <div key={k} className="flex flex-col sm:grid sm:grid-cols-[150px_1fr] gap-0.5 sm:gap-2 min-w-0">
                                <span className="font-mono text-muted-foreground">{k}:</span>
                                <span className="font-mono break-all">
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

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => loadVariableData(selectedVariable)}
                      disabled={loadingVariable === selectedVariable}
                      className="w-full sm:w-auto"
                    >
                      {variables[selectedVariable].data ? 'Reload Data' : 'Load Data'}
                    </Button>
                  </div>
                )}

                {variables[selectedVariable].data && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Data Preview:</Label>
                    <pre className="bg-muted p-3 rounded font-mono text-xs overflow-x-auto max-w-full whitespace-pre-wrap break-all">
                      {formatDataPreview(variables[selectedVariable].data)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Collapsible Dimensions */}
          {Object.keys(dimensions).length > 0 && (
            <Card className="border-0">
              <button
                onClick={() => setExpandedDimensions(!expandedDimensions)}
                className="w-full"
              >
                <CardHeader className="hover:bg-accent/50 transition-colors cursor-pointer p-3 sm:p-6">
                  <CardTitle className="text-base flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Info className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">Dimensions ({Object.keys(dimensions).length})</span>
                    </div>
                    {expandedDimensions ? (
                      <ChevronDown className="h-4 w-4 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 flex-shrink-0" />
                    )}
                  </CardTitle>
                </CardHeader>
              </button>
              
              {expandedDimensions && (
                <CardContent className="p-3 sm:p-6 pt-0">
                  <div className="space-y-2 sm:space-y-1 text-xs overflow-x-auto">
                    {Object.entries(dimensions).map(([name, dim]: [string, any]) => (
                      <div key={name} className="flex flex-col sm:grid sm:grid-cols-[150px_1fr] gap-0.5 sm:gap-2 min-w-0">
                        <span className="font-mono text-muted-foreground">{name}:</span>
                        <span className="font-mono break-all">
                          {dim.size || dim.len || dim.length || 'unlimited'}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Collapsible Attributes */}
          {Object.keys(attributes).length > 0 && (
            <Card className="border-0">
              <button
                onClick={() => setExpandedAttributes(!expandedAttributes)}
                className="w-full"
              >
                <CardHeader className="hover:bg-accent/50 transition-colors cursor-pointer p-3 sm:p-6">
                  <CardTitle className="text-base flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Info className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">Attributes ({Object.keys(attributes).length})</span>
                    </div>
                    {expandedAttributes ? (
                      <ChevronDown className="h-4 w-4 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 flex-shrink-0" />
                    )}
                  </CardTitle>
                </CardHeader>
              </button>
              
              {expandedAttributes && (
                <CardContent className="p-3 sm:p-6 pt-0">
                  <div className="max-h-[300px] overflow-y-auto space-y-2 sm:space-y-1 text-xs overflow-x-auto">
                    {Object.entries(attributes).map(([k, v]) => (
                      <div key={k} className="flex flex-col sm:grid sm:grid-cols-[150px_1fr] gap-0.5 sm:gap-2 min-w-0">
                        <span className="font-mono text-muted-foreground">{k}:</span>
                        <span className="font-mono break-all">
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
          )}
        </div>
      )}
    </div>
  );
};

export default LocalNetCDFMeta;