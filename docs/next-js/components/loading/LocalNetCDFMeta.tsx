'use client';

import React, { ChangeEvent, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// import { MetaNetCDFAccordion } from './MetaNetCDFAccordion';
import { MetaNetCDFButtons } from './MetaNetCDFButtons';

import { NetCDF4 } from '@earthyscience/netcdf4-wasm';
import BrowzarrCTA from './BrowzarrCTA';
const LocalNetCDFMeta = () => {
  const [variables, setVariables] = useState<Record<string, unknown> | null>(null);
  const [attributes, setAttributes] = useState<Record<string, unknown> | null>(null);
  const [metadata, setMetadata] = useState<Record<string, unknown>[] | null>(null);

  const handleFileSelect = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    try {
      const data = await NetCDF4.fromBlobLazy(file);

      const [variables, attrs, metadata] = await Promise.all([
        data.getVariables(),
        data.getGlobalAttributes(),
        data.getFullMetadata(),
      ]);

      setVariables(variables);
      setAttributes(attrs);
      setMetadata(metadata);

    } catch (error) {
      console.error('Error loading NetCDF file:', error);
      alert('Failed to load NetCDF file. Check console for details.');
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
        accept=".nc,.netcdf,.nc3,.nc4"
        onChange={handleFileSelect}
        className="cursor-pointer"
      />
      
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
