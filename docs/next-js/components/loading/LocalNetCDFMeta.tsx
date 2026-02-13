'use client';

import React, { ChangeEvent, useState } from 'react';
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
  CardDescription,
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

  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingVariable, setLoadingVariable] = useState<string | null>(null);

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

    if (!hasChildren) {
      return (
        <DropdownMenuItem 
          onClick={() => onSelect(node.path)}
          className={isSelected ? 'bg-accent' : ''}
        >
          <Folder className="h-4 w-4 mr-2" />
          <div className="flex items-center justify-between flex-1">
            <span>{node.name}</span>
            <div className="flex gap-1 ml-2">
              {node.variableCount > 0 && (
                <Badge variant="secondary" className="text-xs h-5">
                  {node.variableCount} vars
                </Badge>
              )}
            </div>
          </div>
        </DropdownMenuItem>
      );
    }

    return (
      <DropdownMenuSub>
        <DropdownMenuSubTrigger className={isSelected ? 'bg-accent' : ''}>
          <FolderOpen className="h-4 w-4 mr-2" />
          <div className="flex items-center justify-between flex-1">
            <span>{node.name}</span>
            <div className="flex gap-1 ml-2">
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
        <DropdownMenuSubContent>
          <DropdownMenuItem 
            onClick={() => onSelect(node.path)}
            className={isSelected ? 'bg-accent font-semibold' : ''}
          >
            <Folder className="h-4 w-4 mr-2" />
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
    if (!tree || !searchQuery.trim()) return;

    const results = tree.searchVariables(searchQuery);
    if (results.length > 0) {
      const first = results[0];
      selectGroup(first.groupPath);
      setSelectedVariable(first.name);
      if (!variables[first.name]?.info) {
        loadVariableInfo(first.name);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------

  const breadcrumbs = tree ? tree.getBreadcrumbs(currentGroupPath) : [];
  const groupSummary = tree ? tree.getGroupSummary(currentGroupPath) : null;
  const datasetSummary = tree ? tree.getDatasetSummary() : null;

  return (
    <div className="grid w-full max-w-4xl items-center gap-4 p-4 py-0 overflow-hidden">
      {/* Header */}
      <div className="text-center space-y-2">
        <Label className="text-lg font-bold flex items-center justify-center gap-2">
          <Database className="h-5 w-5" />
          NetCDF File Browser
        </Label>
        {datasetSummary && (
          <div className="flex gap-2 justify-center text-xs text-muted-foreground flex-wrap">
            <span>{datasetSummary.totalGroups} groups</span>
            <span>•</span>
            <span>{datasetSummary.totalVariables} variables</span>
            <span>•</span>
            <span>{datasetSummary.totalDimensions} dimensions</span>
          </div>
        )}
      </div>

      {/* File Upload */}
      <Input
        id="netcdf-file"
        type="file"
        onChange={handleFileSelect}
        disabled={isLoading}
      />

      {/* URL Fetch */}
      <Field>
        <ButtonGroup>
          <Input
            placeholder="http:// or https://"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isLoading}
          />
          <Button variant="outline" onClick={handleUrlFetch} disabled={isLoading}>
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
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      {tree && (
        <div className="space-y-4">
          {/* Navigation Bar */}
          <Card>
            <CardContent className="space-y-3">
              {/* Breadcrumbs */}
              <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
                {breadcrumbs.map((crumb, idx) => (
                  <React.Fragment key={crumb.path}>
                    <button
                      onClick={() => selectGroup(crumb.path)}
                      className={`hover:text-foreground transition-colors ${
                        crumb.path === currentGroupPath ? 'text-foreground font-semibold' : ''
                      }`}
                    >
                      {crumb.name}
                    </button>
                    {idx < breadcrumbs.length - 1 && (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </React.Fragment>
                ))}
              </div>

              {/* Controls */}
              <div className="flex gap-2 flex-wrap">
                {/* Group Browser */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <FolderOpen className="h-4 w-4 mr-2" />
                      Browse Groups
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent className="max-h-[400px] overflow-y-auto w-64">
                    {(() => {
                      const groupTree = tree.buildGroupTree();
                      return (
                        <>
                          <DropdownMenuItem 
                            onClick={() => selectGroup('/')}
                            className={currentGroupPath === '/' ? 'bg-accent font-semibold' : ''}
                          >
                            <Folder className="h-4 w-4 mr-2" />
                            <div className="flex items-center justify-between flex-1">
                              <span>/ (root)</span>
                              {groupTree.variableCount > 0 && (
                                <Badge variant="secondary" className="text-xs h-5 ml-2">
                                  {groupTree.variableCount}
                                </Badge>
                              )}
                            </div>
                          </DropdownMenuItem>
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

                {/* Variable Selector */}
                {Object.keys(variables).length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <FileText className="h-4 w-4 mr-2" />
                        {selectedVariable || 'Select Variable'}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-[300px] overflow-y-auto">
                      {Object.keys(variables).map((name) => (
                        <DropdownMenuItem
                          key={name}
                          onClick={() => {
                            setSelectedVariable(name);
                            if (!variables[name].info) loadVariableInfo(name);
                          }}
                        >
                          <FileText className="h-3 w-3 mr-2" />
                          {name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* Search */}
                <div className="flex gap-1 flex-1 min-w-[200px]">
                  <Input
                    placeholder="Search variables..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="h-9 text-sm"
                  />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleSearch}
                    disabled={!searchQuery.trim()}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Group Summary */}
              {groupSummary && (
                <div className="flex gap-3 text-xs">
                  <Badge variant="outline">
                    {groupSummary.variableCount} variables
                  </Badge>
                  <Badge variant="outline">
                    {groupSummary.dimensionCount} dimensions
                  </Badge>
                  <Badge variant="outline">
                    {groupSummary.attributeCount} attributes
                  </Badge>
                  {groupSummary.subgroupCount > 0 && (
                    <Badge variant="outline">
                      {groupSummary.subgroupCount} subgroups
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Variable Details */}
          {selectedVariable && variables[selectedVariable] && (
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 break-all">
                  <FileText className="h-4 w-4 flex-shrink-0" />
                  <span className="break-all">{selectedVariable}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 overflow-hidden">
                {loadingVariable === selectedVariable && (
                  <div className="flex items-center gap-2">
                    <Spinner className="h-4 w-4" />
                    <span className="text-sm text-muted-foreground">Loading...</span>
                  </div>
                )}

                {variables[selectedVariable].info && (
                  <div className="space-y-2">
                    <div className="space-y-1 text-xs">
                      {/* Name */}
                      <div className="grid grid-cols-[150px_1fr] gap-2">
                        <span className="font-mono text-muted-foreground">name:</span>
                        <span className="font-mono break-all">
                          {variables[selectedVariable].info.name}
                        </span>
                      </div>

                      {/* Data Type */}
                      <div className="grid grid-cols-[150px_1fr] gap-2">
                        <span className="font-mono text-muted-foreground">dtype:</span>
                        <span className="font-mono break-all">
                          {variables[selectedVariable].info.dtype}
                        </span>
                      </div>

                      {/* NC Type */}
                      {variables[selectedVariable].info.nctype !== undefined && (
                        <div className="grid grid-cols-[150px_1fr] gap-2">
                          <span className="font-mono text-muted-foreground">nctype:</span>
                          <span className="font-mono break-all">
                            {variables[selectedVariable].info.nctype}
                          </span>
                        </div>
                      )}

                      {/* Shape */}
                      <div className="grid grid-cols-[150px_1fr] gap-2">
                        <span className="font-mono text-muted-foreground">shape:</span>
                        <span className="font-mono break-all">
                          [{variables[selectedVariable].info.shape.join(', ')}]
                        </span>
                      </div>

                      {/* Dimensions */}
                      <div className="grid grid-cols-[150px_1fr] gap-2">
                        <span className="font-mono text-muted-foreground">dimensions:</span>
                        <span className="font-mono break-all">
                          [{variables[selectedVariable].info.dimensions?.join(', ') || 'N/A'}]
                        </span>
                      </div>

                      {/* Size */}
                      <div className="grid grid-cols-[150px_1fr] gap-2">
                        <span className="font-mono text-muted-foreground">size:</span>
                        <span className="font-mono break-all">
                          {variables[selectedVariable].info.size.toLocaleString()}
                        </span>
                      </div>

                      {/* Total Size */}
                      {variables[selectedVariable].info.totalSize !== undefined && (
                        <div className="grid grid-cols-[150px_1fr] gap-2">
                          <span className="font-mono text-muted-foreground">totalSize:</span>
                          <span className="font-mono break-all">
                            {variables[selectedVariable].info.totalSize.toLocaleString()} bytes
                          </span>
                        </div>
                      )}

                      {/* Chunked */}
                      {variables[selectedVariable].info.chunked !== undefined && (
                        <div className="grid grid-cols-[150px_1fr] gap-2">
                          <span className="font-mono text-muted-foreground">chunked:</span>
                          <span className="font-mono break-all">
                            {String(variables[selectedVariable].info.chunked)}
                          </span>
                        </div>
                      )}

                      {/* Chunks */}
                      {variables[selectedVariable].info.chunks && (
                        <div className="grid grid-cols-[150px_1fr] gap-2">
                          <span className="font-mono text-muted-foreground">chunks:</span>
                          <span className="font-mono break-all">
                            [{variables[selectedVariable].info.chunks.join(', ')}]
                          </span>
                        </div>
                      )}

                      {/* Chunk Size */}
                      {variables[selectedVariable].info.chunkSize !== undefined && (
                        <div className="grid grid-cols-[150px_1fr] gap-2">
                          <span className="font-mono text-muted-foreground">chunkSize:</span>
                          <span className="font-mono break-all">
                            {variables[selectedVariable].info.chunkSize.toLocaleString()} bytes
                          </span>
                        </div>
                      )}

                      {/* Variable Attributes */}
                      {variables[selectedVariable].info.attributes && 
                       Object.keys(variables[selectedVariable].info.attributes).length > 0 && (
                        <>
                          <div className="grid grid-cols-[150px_1fr] gap-2 pt-2 border-t">
                            <span className="font-mono text-muted-foreground font-semibold">attributes:</span>
                            <span className="font-mono break-all">
                              ({Object.keys(variables[selectedVariable].info.attributes).length})
                            </span>
                          </div>
                          {Object.entries(variables[selectedVariable].info.attributes).map(([k, v]) => (
                            <div key={k} className="grid grid-cols-[150px_1fr] gap-2 pl-4">
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
                        </>
                      )}
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => loadVariableData(selectedVariable)}
                      disabled={loadingVariable === selectedVariable}
                    >
                      {variables[selectedVariable].data ? 'Reload Data' : 'Load Data'}
                    </Button>
                  </div>
                )}

                {variables[selectedVariable].data && (
                  <div className="space-y-1 overflow-hidden">
                    <Label className="text-xs text-muted-foreground">Data Preview:</Label>
                    <pre className="bg-muted p-3 rounded font-mono text-xs overflow-x-auto max-w-full whitespace-pre-wrap break-all">
                      {formatDataPreview(variables[selectedVariable].data)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Dimensions */}
          {Object.keys(dimensions).length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Dimensions ({Object.keys(dimensions).length})
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-hidden">
                <div className="space-y-1 max-w-full text-xs">
                  {Object.entries(dimensions).map(([name, dim]: [string, any]) => (
                    <div key={name} className="grid grid-cols-[150px_1fr] gap-2">
                      <span className="font-mono text-muted-foreground">{name}:</span>
                      <span className="font-mono break-all">
                        {dim.size || dim.len || dim.length || 'unlimited'}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Attributes */}
          {Object.keys(attributes).length > 0 && (
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Attributes ({Object.keys(attributes).length})
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-hidden">
                <div className="max-h-[300px] overflow-y-auto space-y-1 max-w-full text-xs">
                  {Object.entries(attributes).map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[150px_1fr] gap-2">
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
            </Card>
          )}
        </div>
      )}

      <BrowzarrCTA />
    </div>
  );
};

export default LocalNetCDFMeta;