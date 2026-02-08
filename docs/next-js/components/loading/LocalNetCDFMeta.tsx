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
import { Terminal, ChevronRight } from 'lucide-react';
import { MetaNetCDFButtons } from './MetaNetCDFButtons';
import { NetCDF4 } from '@earthyscience/netcdf4-wasm';
import BrowzarrCTA from './BrowzarrCTA';

const NETCDF_EXT_REGEX = /\.(nc|netcdf|nc3|nc4)$/i;

interface GroupInfo {
  name: string;
  path: string;
  ncid: number;
  hasSubgroups: boolean;
}

const LocalNetCDFMeta = () => {
  const [variables, setVariables] = useState<Record<string, unknown> | null>(null);
  const [attributes, setAttributes] = useState<Record<string, unknown> | null>(null);
  const [metadata, setMetadata] = useState<Record<string, unknown>[] | null>(null);
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
    // Use the unified getCompleteHierarchy method
    const hierarchy = await data.getCompleteHierarchy(groupPath);
    
    setVariables(hierarchy.variables);
    setAttributes(hierarchy.attributes);
    setGroups(hierarchy.groups);
    
    // Get full metadata for variables at this level
    const meta = await data.getFullMetadata(groupPath);
    setMetadata(meta);
    
    // Determine if current group has subgroups
    const hasSubgroups = Object.keys(hierarchy.groups).length > 0;
    
    // Get current group name
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

  const handleFileSelect = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
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
      console.log('Fetched data:', data);
      setDataset(data);
      await loadGroupData(data);
    } catch (err) {
      console.error('Error fetching NetCDF from URL:', err);
      setError('Failed to fetch NetCDF from URL. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGroupChange = async (groupName: string, groupNcid: number) => {
    if (!dataset) return;
    
    try {
      setIsLoading(true);
      // Build new path
      const newPath = currentGroup.path === '/' 
        ? `/${groupName}` 
        : `${currentGroup.path}/${groupName}`;
      
      await loadGroupData(dataset, newPath);
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
    } catch (err) {
      console.error('Error loading parent group:', err);
      setError('Failed to load parent group. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid w-full max-w-sm items-center gap-3 p-4 py-0">
      <Label
        htmlFor="netcdf-file"
        className="justify-self-center font-semibold"
      >
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
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Group Navigation */}
      {variables && attributes && metadata && (
        <>
          <div className="border rounded-md p-3 bg-muted/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Current Group:</span>
                <code className="text-xs bg-background px-2 py-1 rounded">
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
            
            {/* Subgroups */}
            {groups && Object.keys(groups).length > 0 && (
              <div className="mt-2">
                <span className="text-xs text-muted-foreground mb-1 block">
                  Subgroups:
                </span>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(groups).map(([name, groupData]) => (
                    <Button
                      key={name}
                      variant="outline"
                      size="sm"
                      onClick={() => handleGroupChange(name, groupData.ncid || -1)}
                      disabled={isLoading}
                      className="h-7 text-xs cursor-pointer"
                    >
                      {name}
                      <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="justify-self-center">
            <MetaNetCDFButtons
              variables={variables}
              attributes={attributes}
              metadata={metadata}
              currentGroup={currentGroup}
            />
          </div>
        </>
      )}
      <BrowzarrCTA />
    </div>
  );
};

export default LocalNetCDFMeta;