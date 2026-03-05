'use client';
import { ChangeEvent, useState, useEffect, useCallback } from 'react';
import { NetCDF4, DataTree } from '@earthyscience/netcdf4-wasm';
import { VariableData, VariableInfo, VariableArrayData, Dimension } from './types';
import { SliceSelectionState, defaultSelection, buildSelection } from './SliceTester';

const NETCDF_EXT_REGEX = /\.(nc|netcdf|nc3|nc4)$/i;

export const useViewerState = () => {
  // Dataset
  const [tree, setTree] = useState<DataTree | null>(null);
  const [dataset, setDataset] = useState<NetCDF4 | null>(null);

  // Group / variable state
  const [currentGroupPath, setCurrentGroupPath] = useState<string>('/');
  const [variables, setVariables] = useState<Record<string, VariableData>>({});
  const [attributes, setAttributes] = useState<Record<string, unknown>>({});
  const [dimensions, setDimensions] = useState<Record<string, Dimension>>({});
  const [selectedVariable, setSelectedVariable] = useState<string | null>(null);
  const [pendingVariableLoad, setPendingVariableLoad] = useState<{
    name: string;
    groupPath: string;
  } | null>(null);

  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  const [loadingVariable, setLoadingVariable] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState('');

  // Data controls
  const [sliceSize, setSliceSize] = useState<string>('10');

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

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ name: string; groupPath: string }>>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

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
        ) as VariableInfo;
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
        ) as VariableArrayData;
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
          ) as VariableArrayData;
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
          ) as VariableArrayData;
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

  // Slice tester state
  const [sliceSelections, setSliceSelections] = useState<SliceSelectionState[]>([]);
  const [expandedSliceTester, setExpandedSliceTester] = useState(true);
  const [sliceResult, setSliceResult] = useState<VariableArrayData | null>(null);
  const [sliceError, setSliceError] = useState<string | null>(null);
  const [loadingSlice, setLoadingSlice] = useState(false);

  // Reset slice tester when selected variable changes
  useEffect(() => {
    if (!selectedVariable) return;
    const info = variables[selectedVariable]?.info;
    if (!info?.shape) return;
    setSliceSelections(info.shape.map(() => defaultSelection()));
    setSliceResult(null);
    setSliceError(null);
  }, [selectedVariable, variables]);

  const handleRunSlice = useCallback(async () => {
    if (!dataset || !selectedVariable) return;
    const info = variables[selectedVariable]?.info;
    if (!info?.shape) return;
    setLoadingSlice(true);
    setSliceError(null);
    try {
      const selection = buildSelection(sliceSelections);
      // or, await (dataset as NetCDF4).get(...) if you prefer an explicit cast.
      const data = await dataset.get(
        selectedVariable,
        selection,
        currentGroupPath === '/' ? undefined : currentGroupPath
      ) as VariableArrayData;
      setSliceResult(data);
    } catch (err) {
      setSliceError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingSlice(false);
    }
  }, [dataset, selectedVariable, variables, sliceSelections, currentGroupPath]);

  // Derived values

  const breadcrumbs = tree ? tree.getBreadcrumbs(currentGroupPath) : [];
  const groupSummary = tree ? tree.getGroupSummary(currentGroupPath) : null;
  const datasetSummary = tree ? tree.getDatasetSummary() : null;

  return {
    // Dataset
    tree,
    // Group / variable state
    currentGroupPath,
    variables,
    attributes,
    dimensions,
    selectedVariable,
    setSelectedVariable,
    setPendingVariableLoad,
    // Loading state
    isLoading,
    loadingVariable,
    error,
    url,
    setUrl,
    // Data controls
    sliceSize,
    setSliceSize,
    // Expand/collapse state
    expandedVariableInfo,
    setExpandedVariableInfo,
    expandedVariableAttrs,
    setExpandedVariableAttrs,
    expandedDimensions,
    setExpandedDimensions,
    expandedAttributes,
    setExpandedAttributes,
    expandedEnumDict,
    setExpandedEnumDict,
    // Menu states
    showGroupMenu,
    setShowGroupMenu,
    showVariableMenu,
    setShowVariableMenu,
    expandedGroups,
    // Search
    searchQuery,
    searchResults,
    showSearchResults,
    setShowSearchResults,
    // Callbacks
    loadVariableInfo,
    loadVariableData,
    loadVariableSlice,
    handleFileSelect,
    handleUrlFetch,
    selectGroup,
    handleToggleGroupExpand,
    handleSearchInputChange,
    selectSearchResult,
    // Slice tester
    sliceSelections,
    setSliceSelections,
    expandedSliceTester,
    setExpandedSliceTester,
    sliceResult,
    sliceError,
    loadingSlice,
    handleRunSlice,
    // Derived
    breadcrumbs,
    groupSummary,
    datasetSummary,
  };
};