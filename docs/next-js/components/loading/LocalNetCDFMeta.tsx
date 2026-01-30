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
  const [url, setUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const validateUrl = (urlString: string): boolean => {
    if (!urlString.trim()) {
      setError('Please enter a URL.');
      return false;
    }

    // Check for common protocols
    const validProtocols = ['http://', 'https://', 's3://', 'gs://', 'ftp://'];
    const hasValidProtocol = validProtocols.some(protocol => 
      urlString.toLowerCase().startsWith(protocol)
    );

    if (!hasValidProtocol) {
      setError('URL must start with a valid protocol (http://, https://, s3://, gs://, or ftp://)');
      return false;
    }

    // Optional: Check if URL ends with NetCDF extension
    if (!NETCDF_EXT_REGEX.test(urlString)) {
      setError('URL should point to a NetCDF file (.nc, .netcdf, .nc3, .nc4)');
      return false;
    }

    return true;
  };

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
      setIsLoading(true);
      const data = await NetCDF4.fromBlobLazy(file);
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
      // const urlTry = await NetCDF4.Dataset("s3://its-live-data/test-space/sample-data/sst.mnmean.nc")
      // console.log(urlTry)
      const data = await NetCDF4.Dataset(url);
      console.log('Fetched data:', data);
      
      const [vars, attrs, meta] = await Promise.all([
        data.getVariables(),
        data.getGlobalAttributes(),
        data.getFullMetadata(),
      ]);
      setVariables(vars);
      setAttributes(attrs);
      setMetadata(meta);
    } catch (err) {
      console.error('Error fetching NetCDF from URL:', err);
      setError('Failed to fetch NetCDF from URL. Check console for details.');
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