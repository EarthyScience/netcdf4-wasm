'use client';

import React, { ChangeEvent, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { NetCDF4, DataTree } from '@earthyscience/netcdf4-wasm';
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

  const [selectedVariable, setSelectedVariable] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingVariable, setLoadingVariable] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const refreshGroup = (path: string, dataTree: DataTree) => {
    const group = dataTree.getGroup(path);

    setCurrentGroupPath(path);
    setVariables(group?.variables || {});
    setAttributes(group?.attributes || {});
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
  // Build flat group list for dropdown
  // ---------------------------------------------------------------------------

  const getAllGroups = () => {
    if (!tree) return [];
    return tree.listGroups(); // assume you expose this helper
  };

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------

  return (
    <div className="grid w-full max-w-2xl items-center gap-3 p-4 py-0">
      <Label htmlFor="netcdf-file" className="justify-self-center font-semibold">
        NetCDF file
      </Label>

      <Input
        id="netcdf-file"
        type="file"
        onChange={handleFileSelect}
        disabled={isLoading}
      />

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

      {/* ========================================================= */}
      {/* DATA VIEW */}
      {/* ========================================================= */}

      {tree && (
        <div className="border rounded-md p-4 bg-background space-y-4">
          {/* Current group */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Current Group:</span>
            <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
              {currentGroupPath}
            </code>
          </div>

          {/* Groups dropdown */}
          <div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">Select Group</Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent>
                {getAllGroups().map(({ name, path }) => (
                  <DropdownMenuItem
                    key={path}
                    onClick={() => selectGroup(path)}
                  >
                    {name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>

            </DropdownMenu>
          </div>


          {/* Variables dropdown */}
          <div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  {selectedVariable || 'Select Variable'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {Object.keys(variables).map((name) => (
                  <DropdownMenuItem
                    key={name}
                    onClick={() => {
                      setSelectedVariable(name);
                      if (!variables[name].info) loadVariableInfo(name);
                    }}
                  >
                    {name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Variable details */}
          {selectedVariable && variables[selectedVariable] && (
            <div className="border rounded p-3 text-xs space-y-2">
              {loadingVariable === selectedVariable && <Spinner className="h-4 w-4" />}

              {variables[selectedVariable].info && (
                <div className="grid grid-cols-[100px_1fr] gap-1">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-mono">
                    {variables[selectedVariable].info.dtype}
                  </span>

                  <span className="text-muted-foreground">Shape:</span>
                  <span className="font-mono">
                    [{variables[selectedVariable].info.shape.join(', ')}]
                  </span>

                  <span className="text-muted-foreground">Size:</span>
                  <span>
                    {variables[selectedVariable].info.size.toLocaleString()}
                  </span>
                </div>
              )}

              <Button
                size="sm"
                variant="outline"
                onClick={() => loadVariableData(selectedVariable)}
              >
                Load Data
              </Button>

              {variables[selectedVariable].data && (
                <pre className="bg-muted p-2 rounded font-mono">
                  {formatDataPreview(variables[selectedVariable].data)}
                </pre>
              )}
            </div>
          )}

          {/* Attributes */}
          <div className="space-y-1">
            <div className="text-sm font-semibold">
              Attributes ({Object.keys(attributes).length})
            </div>

            {Object.entries(attributes).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[150px_1fr] gap-2 text-xs">
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
        </div>
      )}

      <BrowzarrCTA />
    </div>
  );
};

export default LocalNetCDFMeta;