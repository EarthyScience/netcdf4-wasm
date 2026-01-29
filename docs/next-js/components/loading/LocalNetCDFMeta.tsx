'use client';

import React, { ChangeEvent, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Terminal } from 'lucide-react';

import { MetaNetCDFButtons } from './MetaNetCDFButtons';
import { NetCDF4 } from '@earthyscience/netcdf4-wasm';
import BrowzarrCTA from './BrowzarrCTA';

const NETCDF_EXT_REGEX = /\.(nc|netcdf|nc3|nc4)$/i;

const LocalNetCDFMeta = () => {
  const [variables, setVariables] = useState<Record<string, unknown> | null>(null);
  const [attributes, setAttributes] = useState<Record<string, unknown> | null>(null);
  const [metadata, setMetadata] = useState<Record<string, unknown>[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    setError(null);

    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // Manual validation (iOS-safe)
    if (!NETCDF_EXT_REGEX.test(file.name)) {
      setError('Please select a valid NetCDF (.nc, .netcdf, .nc3, .nc4) file.');
      return;
    }

    try {
      const data = await NetCDF4.fromBlobLazy(file);
      const urlTry = await NetCDF4.Dataset("s3://its-live-data/test-space/sample-data/sst.mnmean.nc")
      console.log(urlTry)
      const [vars, attrs, meta] = await Promise.all([
        data.getVariables(),
        data.getGlobalAttributes(),
        data.getFullMetadata(),
      ]);

      setVariables(vars);
      setAttributes(attrs);
      setMetadata(meta);
    } catch (err) {
      console.error('Error loading NetCDF file:', err);
      setError('Failed to load NetCDF file. Check console for details.');
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
      />

      {error && (
        <Alert variant="destructive">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Hey!</AlertTitle>
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      )}

      {variables && attributes && metadata && (
        <div className="justify-self-center">
          <MetaNetCDFButtons
            variables={variables}
            attributes={attributes}
            metadata={metadata}
          />
        </div>
      )
      }
      <BrowzarrCTA />
      
    </div>
  );
};

export default LocalNetCDFMeta;
