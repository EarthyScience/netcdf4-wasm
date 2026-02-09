'use client';
import React, { ChangeEvent, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Terminal, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { NetCDF4 } from '@earthyscience/netcdf4-wasm';
import BrowzarrCTA from './BrowzarrCTA';

const NETCDF_EXT_REGEX = /\.(nc|netcdf|nc3|nc4)$/i;

interface GroupInfo {
  name: string;
  path: string;
  ncid: number;
  hasSubgroups: boolean;
}

interface VariableData {
  id: number;
  info?: any;
  data?: any;
  slice?: { start: number[]; count: number[] };
}

const LocalNetCDFMeta = () => {
  const [variables, setVariables] = useState<Record<string, VariableData> | null>(null);
  const [attributes, setAttributes] = useState<Record<string, unknown> | null>(null);
  const [groups, setGroups] = useState<Record<string, any> | null>(null);
  const [currentGroup, setCurrentGroup] = useState<GroupInfo>({
    name: 'root',
    path: '/',
    ncid: -1,
    hasSubgroups: false
  });
  const [dataset, setDataset] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // UI state
  const [expandedVariables, setExpandedVariables] = useState<Set<string>>(new Set());
  const [showVariables, setShowVariables] = useState(true);
  const [showAttributes, setShowAttributes] = useState(false);
  const [loadingVariable, setLoadingVariable] = useState<string | null>(null);

  const validateUrl = (urlString: string): boolean => {
    if (!urlString.trim()) {
      setError('Please enter a URL.');
      return false;
    }

    const validProtocols = ['http://', 'https://', 's3://', 'gs://', 'ftp://'];
    const hasValidProtocol = validProtocols.some(protocol => 
      urlString.toLowerCase().startsWith(protocol)
    );

    if (!hasValidProtocol) {
      setError('URL must start with a valid protocol (http://, https://, s3://, gs://, or ftp://)');
      return false;
    }

    if (!NETCDF_EXT_REGEX.test(urlString)) {
      setError('URL should point to a NetCDF file (.nc, .netcdf, .nc3, .nc4)');
      return false;
    }

    return true;
  };

  const loadGroupData = async (data: any, groupPath?: string) => {
    const hierarchy = await data.getCompleteHierarchy(groupPath);
    
    setVariables(hierarchy.variables);
    setAttributes(hierarchy.attributes);
    setGroups(hierarchy.groups);
    
    const hasSubgroups = Object.keys(hierarchy.groups).length > 0;
    
    let groupName = 'root';
    if (groupPath && groupPath !== '/') {
      const parts = groupPath.split('/').filter(p => p);
      groupName = parts[parts.length - 1] || 'root';
    }
    
    setCurrentGroup({
      name: groupName,
      path: groupPath || '/',
      ncid: -1,
      hasSubgroups
    });
  };

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    if (!NETCDF_EXT_REGEX.test(file.name)) {
      setError('Please select a valid NetCDF (.nc, .netcdf, .nc3, .nc4) file.');
      return;
    }

    try {
      setIsLoading(true);
      const data = await NetCDF4.fromBlobLazy(file);
      setDataset(data);
      await loadGroupData(data);
    } catch (err) {
      console.error('Error loading NetCDF file:', err);
      setError('Failed to load NetCDF file. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUrlFetch = async () => {
    setError(null);

    if (!validateUrl(url)) {
      return;
    }

    try {
      setIsLoading(true);
      const data = await NetCDF4.Dataset(url);
      setDataset(data);
      await loadGroupData(data);
    } catch (err) {
      console.error('Error fetching NetCDF from URL:', err);
      setError('Failed to fetch NetCDF from URL. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGroupChange = async (groupName: string) => {
    if (!dataset) return;
    
    try {
      setIsLoading(true);
      const newPath = currentGroup.path === '/' 
        ? `/${groupName}` 
        : `${currentGroup.path}/${groupName}`;
      
      await loadGroupData(dataset, newPath);
      setExpandedVariables(new Set());
    } catch (err) {
      console.error('Error loading group:', err);
      setError('Failed to load group. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToRoot = async () => {
    if (!dataset) return;
    
    try {
      setIsLoading(true);
      await loadGroupData(dataset);
      setExpandedVariables(new Set());
    } catch (err) {
      console.error('Error loading root:', err);
      setError('Failed to load root. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToParent = async () => {
    if (!dataset || currentGroup.path === '/') return;
    
    try {
      setIsLoading(true);
      const pathParts = currentGroup.path.split('/').filter(p => p);
      pathParts.pop();
      const parentPath = pathParts.length > 0 ? '/' + pathParts.join('/') : '/';
      
      await loadGroupData(dataset, parentPath === '/' ? undefined : parentPath);
      setExpandedVariables(new Set());
    } catch (err) {
      console.error('Error loading parent group:', err);
      setError('Failed to load parent group. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleVariable = async (varName: string) => {
    const newExpanded = new Set(expandedVariables);
    
    if (newExpanded.has(varName)) {
      newExpanded.delete(varName);
      setExpandedVariables(newExpanded);
    } else {
      // Expand and load variable info if not already loaded
      newExpanded.add(varName);
      setExpandedVariables(newExpanded);
      
      if (variables && !variables[varName].info) {
        setLoadingVariable(varName);
        try {
          const info = await dataset.getVariableInfo(varName, currentGroup.path === '/' ? undefined : currentGroup.path);
          setVariables(prev => ({
            ...prev!,
            [varName]: { ...prev![varName], info }
          }));
        } catch (err) {
          console.error('Error loading variable info:', err);
        } finally {
          setLoadingVariable(null);
        }
      }
    }
  };

  const loadVariableData = async (varName: string, slice?: { start: number[]; count: number[] }) => {
    if (!dataset || !variables) return;
    
    setLoadingVariable(varName);
    setError(null);
    
    try {
      console.log(`Loading data for ${varName}`, slice ? `with slice ${JSON.stringify(slice)}` : 'full array');
      console.log('Current group path:', currentGroup.path);
      
      // Use the current group path so the getter uses the correct ncid
      const groupPathForQuery = currentGroup.path === '/' ? undefined : currentGroup.path;
      
      let data;
      if (slice) {
        data = await dataset.getSlicedVariableArray(
          varName,  // Use variable name, not ID
          slice.start, 
          slice.count,
          groupPathForQuery  // This ensures we use the right ncid
        );
      } else {
        data = await dataset.getVariableArray(
          varName,  // Use variable name, not ID
          groupPathForQuery  // This ensures we use the right ncid
        );
      }
      
      console.log(`Successfully loaded ${data.length} elements for ${varName}`);
      
      setVariables(prev => ({
        ...prev!,
        [varName]: { ...prev![varName], data, slice }
      }));
    } catch (err: any) {
      console.error('Error loading variable data:', err);
      const errorMsg = err.message || String(err);
      setError(`Failed to load data for ${varName}: ${errorMsg}`);
    } finally {
      setLoadingVariable(null);
    }
  };

  const formatDataPreview = (data: any, maxItems: number = 10): string => {
    if (!data) return 'No data';
    
    const arr = Array.isArray(data) ? data : Array.from(data);
    if (arr.length === 0) return '[]';
    
    const preview = arr.slice(0, maxItems).map(v => {
      if (typeof v === 'number') {
        return v.toFixed(4);
      }
      return String(v);
    });
    
    const suffix = arr.length > maxItems ? `, ... (${arr.length} total)` : '';
    return `[${preview.join(', ')}${suffix}]`;
  };

  return (
    <div className="grid w-full max-w-2xl items-center gap-3 p-4 py-0">
      <Label htmlFor="netcdf-file" className="justify-self-center font-semibold">
        NetCDF file
      </Label>
      <Input
        id="netcdf-file"
        type="file"
        onChange={handleFileSelect}
        className="cursor-pointer"
        disabled={isLoading}
      />

      <Field>
        <ButtonGroup>
          <Input
            id="netcdf-url"
            placeholder="http://, https://, s3://, gs:// or ftp://"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleUrlFetch();
              }
            }}
          />
          <Button
            variant="outline"
            className='cursor-pointer'
            onClick={handleUrlFetch}
            disabled={isLoading}
          >
            Fetch
          </Button>
        </ButtonGroup>
        <p className="text-xs text-muted-foreground mt-1 text-right">
          ⚠️ Work in progress
        </p>
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
          <AlertTitle>Hey!</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      {variables && attributes && (
        <div className="border rounded-md p-4 bg-background space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Current Group:</span>
              <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                {currentGroup.path}
              </code>
            </div>
            {currentGroup.path !== '/' && (
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGoToParent}
                  disabled={isLoading}
                  className="h-7 text-xs cursor-pointer"
                >
                  ← Parent
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGoToRoot}
                  disabled={isLoading}
                  className="h-7 text-xs cursor-pointer"
                >
                  Root
                </Button>
              </div>
            )}
          </div>

          {/* Variables Section */}
          <div className="space-y-2">
            <button
              onClick={() => setShowVariables(!showVariables)}
              className="flex items-center gap-2 text-sm font-semibold hover:text-primary transition-colors"
            >
              {showVariables ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Variables ({Object.keys(variables).length})
            </button>
            
            {showVariables && (
              <div className="ml-4 space-y-2">
                {Object.entries(variables).map(([varName, varData]) => (
                  <div key={varName} className="border rounded-md p-2 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => toggleVariable(varName)}
                        className="flex items-center gap-2 text-sm hover:text-primary transition-colors flex-1 text-left"
                      >
                        {expandedVariables.has(varName) ? 
                          <ChevronDown className="h-3 w-3" /> : 
                          <ChevronRight className="h-3 w-3" />
                        }
                        <span className="font-mono font-medium">{varName}</span>
                        {varData.info && (
                          <span className="text-xs text-muted-foreground">
                            [{varData.info.shape.join(' × ')}]
                          </span>
                        )}
                      </button>
                      {loadingVariable === varName && <Spinner className="h-3 w-3" />}
                    </div>

                    {expandedVariables.has(varName) && varData.info && (
                      <div className="mt-2 ml-5 space-y-2 text-xs">
                        <div className="grid grid-cols-[100px_1fr] gap-x-2 gap-y-1">
                          <span className="text-muted-foreground">Type:</span>
                          <span className="font-mono">{varData.info.dtype}</span>
                          
                          <span className="text-muted-foreground">Shape:</span>
                          <span className="font-mono">[{varData.info.shape.join(', ')}]</span>
                          
                          <span className="text-muted-foreground">Dimensions:</span>
                          <span className="font-mono">{varData.info.dims.map((d: any) => d.name).join(', ')}</span>
                          
                          <span className="text-muted-foreground">Size:</span>
                          <span>{varData.info.size.toLocaleString()} elements</span>
                        </div>

                        {/* Data Loading Controls */}
                        <div className="pt-2 border-t space-y-2">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => loadVariableData(varName)}
                              disabled={loadingVariable === varName}
                              className="h-7 text-xs cursor-pointer"
                            >
                              Load Full Data
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                // Load first 10 elements as a slice
                                const start = varData.info.shape.map(() => 0);
                                const count = [...varData.info.shape];
                                count[0] = Math.min(10, count[0]);
                                loadVariableData(varName, { start, count });
                              }}
                              disabled={loadingVariable === varName}
                              className="h-7 text-xs cursor-pointer"
                            >
                              Load Sample (first 10)
                            </Button>
                          </div>

                          {/* Data Display */}
                          {varData.data && (
                            <div className="bg-background p-2 rounded border">
                              <div className="text-xs text-muted-foreground mb-1">
                                {varData.slice ? 
                                  `Slice: start=[${varData.slice.start.join(', ')}], count=[${varData.slice.count.join(', ')}]` :
                                  'Full data:'
                                }
                              </div>
                              <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                                {formatDataPreview(varData.data, 20)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {Object.keys(variables).length === 0 && (
                  <p className="text-sm text-muted-foreground italic ml-4">No variables in this group</p>
                )}
              </div>
            )}
          </div>

          {/* Subgroups Section */}
          {groups && Object.keys(groups).length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold">Subgroups:</div>
              <div className="ml-4 flex flex-wrap gap-2">
                {Object.entries(groups).map(([name]) => (
                  <Button
                    key={name}
                    variant="outline"
                    size="sm"
                    onClick={() => handleGroupChange(name)}
                    disabled={isLoading}
                    className="h-8 text-xs cursor-pointer"
                  >
                    {name}
                    <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Attributes Section */}
          <div className="space-y-2">
            <button
              onClick={() => setShowAttributes(!showAttributes)}
              className="flex items-center gap-2 text-sm font-semibold hover:text-primary transition-colors"
            >
              {showAttributes ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Attributes ({Object.keys(attributes).length})
            </button>
            
            {showAttributes && (
              <div className="ml-4 space-y-1">
                {Object.entries(attributes).map(([key, value]) => (
                  <div key={key} className="grid grid-cols-[150px_1fr] gap-2 text-xs">
                    <span className="font-mono text-muted-foreground truncate">{key}:</span>
                    <span className="font-mono break-all">
                      {typeof value === 'object'
                        ? JSON.stringify(value, (_key, val) =>
                            typeof val === 'bigint' ? parseInt(val.toString()) : val
                          )
                        : String(value)}
                    </span>
                  </div>
                ))}
                {Object.keys(attributes).length === 0 && (
                  <p className="text-sm text-muted-foreground italic">No attributes in this group</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <BrowzarrCTA />
    </div>
  );
};

export default LocalNetCDFMeta;