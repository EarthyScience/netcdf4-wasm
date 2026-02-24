'use client';
import React, { ChangeEvent, useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { FileText, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { NetCDF4, DataTree } from '@earthyscience/netcdf4-wasm';

import {
  FileLoader,
  GroupBrowserTrigger,
  GroupBrowserPanel,
  VariableMenuTrigger,
  VariableMenuPanel,
  SearchBar,
  VariableDetails,
  VariableDataLoader,
  DimensionsCard,
  AttributesCard,
  type VariableData,
} from '@/components/loading/netcdf';

const NETCDF_EXT_REGEX = /\.(nc|netcdf|nc3|nc4)$/i;

const Viewer = () => {
  const [tree, setTree] = useState<DataTree | null>(null);
  const [dataset, setDataset] = useState<any>(null);
  const [currentGroupPath, setCurrentGroupPath] = useState<string>('/');
  const [variables, setVariables] = useState<Record<string, VariableData>>({});
  const [attributes, setAttributes] = useState<Record<string, unknown>>({});
  const [dimensions, setDimensions] = useState<Record<string, any>>({});
  const [selectedVariable, setSelectedVariable] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ name: string; groupPath: string }>>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [pendingVariableLoad, setPendingVariableLoad] = useState<{
    name: string;
    groupPath: string;
  } | null>(null);
  const [sliceSize, setSliceSize] = useState<string>('10');
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingVariable, setLoadingVariable] = useState<string | null>(null);

  // Expand/collapse state
  const [expandedVariableInfo, setExpandedVariableInfo] = useState(true);
  const [expandedVariableAttrs, setExpandedVariableAttrs] = useState(true);
  const [expandedDimensions, setExpandedDimensions] = useState(true);
  const [expandedAttributes, setExpandedAttributes] = useState(true);
  const [expandedEnumDict, setExpandedEnumDict] = useState(false);

  // Menu states
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [showVariableMenu, setShowVariableMenu] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['/']));

  // Helpers

  const refreshGroup = useCallback((path: string, dataTree: DataTree) => {
    setCurrentGroupPath(path);
    setVariables(dataTree.getAllVariables(path));
    setAttributes(dataTree.getAttributes(path));
    setDimensions(dataTree.getDimensions(path));
    setSelectedVariable(null);
  }, []);

  const loadVariableInfo = useCallback(
    async (varName: string) => {
      if (!dataset) return;
      setLoadingVariable(varName);
      try {
        const info = await dataset.getVariableInfo(
          varName,
          currentGroupPath === '/' ? undefined : currentGroupPath
        );
        setVariables((prev) => ({ ...prev, [varName]: { ...prev[varName], info } }));
      } finally {
        setLoadingVariable(null);
      }
    },
    [dataset, currentGroupPath]
  );

  const loadVariableData = useCallback(
    async (varName: string) => {
      if (!dataset) return;
      setLoadingVariable(varName);
      try {
        const data = await dataset.getVariableArray(
          varName,
          currentGroupPath === '/' ? undefined : currentGroupPath
        );
        setVariables((prev) => ({ ...prev, [varName]: { ...prev[varName], data } }));
      } finally {
        setLoadingVariable(null);
      }
    },
    [dataset, currentGroupPath]
  );

  const loadVariableSlice = useCallback(
    async (varName: string, size: number) => {
      if (!dataset) return;
      setLoadingVariable(varName);
      try {
        const info = variables[varName]?.info;
        if (!info) return;
        const shape = info.shape;
        if (shape.length === 0) {
          const data = await dataset.getVariableArray(
            varName,
            currentGroupPath === '/' ? undefined : currentGroupPath
          );
          setVariables((prev) => ({ ...prev, [varName]: { ...prev[varName], data } }));
        } else {
          const start = new Array(shape.length).fill(0);
          const count = [...shape];
          count[0] = Math.min(size, shape[0]);
          const data = await dataset.getSlicedVariableArray(
            varName,
            start,
            count,
            currentGroupPath === '/' ? undefined : currentGroupPath
          );
          setVariables((prev) => ({ ...prev, [varName]: { ...prev[varName], data } }));
        }
      } finally {
        setLoadingVariable(null);
      }
    },
    [dataset, currentGroupPath, variables]
  );

  // Handle pending variable selection after group navigation
  useEffect(() => {
    if (pendingVariableLoad && currentGroupPath === pendingVariableLoad.groupPath) {
      setSelectedVariable(pendingVariableLoad.name);
      if (variables[pendingVariableLoad.name] && !variables[pendingVariableLoad.name].info) {
        loadVariableInfo(pendingVariableLoad.name);
      }
      setPendingVariableLoad(null);
    }
  }, [currentGroupPath, variables, pendingVariableLoad, loadVariableInfo]);

  // URL validation

  const validateUrl = (urlString: string): boolean => {
    if (!urlString.trim()) {
      setError('Please enter a URL.');
      return false;
    }
    const validProtocols = ['http://', 'https://', 's3://', 'gs://', 'ftp://'];
    if (!validProtocols.some((p) => urlString.toLowerCase().startsWith(p))) {
      setError('URL must start with a valid protocol (http://, https://, s3://, gs://, or ftp://)');
      return false;
    }
    if (!NETCDF_EXT_REGEX.test(urlString)) {
      setError('URL should point to a NetCDF file (.nc, .netcdf, .nc3, .nc4)');
      return false;
    }
    return true;
  };

  // File / URL loading

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
    if (!validateUrl(url)) return;
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

  // Group navigation

  const selectGroup = (path: string, { openMenu = true } = {}) => {
    if (!tree) return;
    refreshGroup(path, tree);
    if (openMenu) setShowGroupMenu(true);
    setShowVariableMenu(false);
    const newExpanded = new Set(expandedGroups);
    const parts = path.split('/').filter(Boolean);
    let currentPath = '/';
    newExpanded.add(currentPath);
    for (const part of parts) {
      currentPath = `${currentPath}${part}/`;
      newExpanded.add(currentPath);
    }
    setExpandedGroups(newExpanded);
  };

  const handleToggleGroupExpand = (path: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedGroups(newExpanded);
  };

  // Search

  const handleSearchInputChange = (value: string) => {
    setSearchQuery(value);
    if (!value.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    if (tree) {
      const results = tree.searchVariables(value);
      setSearchResults(results);
      setShowSearchResults(true);
    }
  };

  const selectSearchResult = (result: { name: string; groupPath: string }) => {
    setPendingVariableLoad(result);
    selectGroup(result.groupPath, { openMenu: false });
    setShowSearchResults(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  // UI

  const breadcrumbs = tree ? tree.getBreadcrumbs(currentGroupPath) : [];
  const groupSummary = tree ? tree.getGroupSummary(currentGroupPath) : null;
  const datasetSummary = tree ? tree.getDatasetSummary() : null;

  return (
    <div className="w-full max-w-4xl mx-auto px-2 sm:px-4 py-0 space-y-3 sm:space-y-4">
      <FileLoader
        url={url}
        isLoading={isLoading}
        error={error}
        onUrlChange={setUrl}
        onFileSelect={handleFileSelect}
        onUrlFetch={handleUrlFetch}
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

      {tree && (
        <div className="space-y-3 sm:space-y-4">
          {/* Navigation Bar */}
          <Card className="border-0 py-4">
            <CardContent className="space-y-3 p-2 sm:p-3">

              {/* Row 1: trigger buttons + search */}
              <div className="flex gap-2 flex-wrap">
                <GroupBrowserTrigger
                  showGroupMenu={showGroupMenu}
                  onToggleMenu={() => {
                    setShowGroupMenu(!showGroupMenu);
                    if (!showGroupMenu) setShowVariableMenu(false);
                  }}
                />

                {Object.keys(variables).length > 0 && (
                  <VariableMenuTrigger
                    showVariableMenu={showVariableMenu}
                    onToggle={() => {
                      setShowVariableMenu(!showVariableMenu);
                      if (!showVariableMenu) setShowGroupMenu(false);
                    }}
                  />
                )}

                <SearchBar
                  searchQuery={searchQuery}
                  searchResults={searchResults}
                  showSearchResults={showSearchResults}
                  onQueryChange={handleSearchInputChange}
                  onSearch={() => handleSearchInputChange(searchQuery)}
                  onSelectResult={selectSearchResult}
                  onDismissResults={() => setShowSearchResults(false)}
                />
              </div>

              {/* Row 2: group summary badges + breadcrumbs */}
              <div className="flex flex-col gap-3">
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

                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <div className="flex items-center gap-1 text-muted-foreground flex-wrap">
                    {breadcrumbs.map((crumb, idx) => (
                      <React.Fragment key={crumb.path}>
                        <button
                          onClick={() => selectGroup(crumb.path)}
                          className={`hover:text-foreground transition-colors cursor-pointer break-all ${
                            crumb.path === currentGroupPath
                              ? 'text-foreground font-semibold'
                              : ''
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
              </div>

              {/* Row 3: dropdown panels — rendered below breadcrumbs */}
              {showGroupMenu && (
                <GroupBrowserPanel
                  tree={tree}
                  currentGroupPath={currentGroupPath}
                  expandedGroups={expandedGroups}
                  onToggleExpand={handleToggleGroupExpand}
                  onVariableClick={(varName, groupPath) => {
                    if (currentGroupPath !== groupPath) selectGroup(groupPath);
                    setPendingVariableLoad({ name: varName, groupPath });
                    setShowGroupMenu(false);
                  }}
                />
              )}

              {showVariableMenu && (
                <VariableMenuPanel
                  variables={variables}
                  selectedVariable={selectedVariable}
                  onSelect={(name) => {
                    setSelectedVariable(name);
                    if (!variables[name].info) loadVariableInfo(name);
                    setShowVariableMenu(false);
                  }}
                />
              )}

            </CardContent>
          </Card>

          {/* Variable Details */}
          {selectedVariable && variables[selectedVariable] && (
            <VariableDetails
              variable={variables[selectedVariable]}
              expandedVariableInfo={expandedVariableInfo}
              expandedVariableAttrs={expandedVariableAttrs}
              expandedEnumDict={expandedEnumDict}
              onToggleVariableInfo={() => setExpandedVariableInfo(!expandedVariableInfo)}
              onToggleVariableAttrs={() => setExpandedVariableAttrs(!expandedVariableAttrs)}
              onToggleEnumDict={() => setExpandedEnumDict(!expandedEnumDict)}
            />
          )}

          {/* Variable Data Loader */}
          {selectedVariable && variables[selectedVariable]?.info && (
            <VariableDataLoader
              variableName={selectedVariable}
              variable={variables[selectedVariable]}
              loadingVariable={loadingVariable}
              sliceSize={sliceSize}
              onSliceSizeChange={setSliceSize}
              onLoadSlice={loadVariableSlice}
              onLoadAll={loadVariableData}
            />
          )}

          <DimensionsCard
            dimensions={dimensions}
            expanded={expandedDimensions}
            onToggle={() => setExpandedDimensions(!expandedDimensions)}
          />

          <AttributesCard
            attributes={attributes}
            expanded={expandedAttributes}
            onToggle={() => setExpandedAttributes(!expandedAttributes)}
          />
        </div>
      )}
    </div>
  );
};

export default Viewer;