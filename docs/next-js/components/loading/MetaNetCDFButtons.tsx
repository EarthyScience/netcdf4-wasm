'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

type Props = {
  variables: Record<string, unknown>;
  attributes: Record<string, unknown>;
  metadata: Record<string, unknown>[];
};

function ObjectViewer({ 
  data, 
  defaultAttributes = [] 
}: { 
  data: Record<string, unknown>;
  defaultAttributes?: string[];
}) {
  const keys = Object.keys(data);
  if (keys.length === 0) return null;

  // Order default attributes first (if provided)
  const orderedKeys = [
    ...defaultAttributes.filter((key) => key in data),
    ...keys.filter((key) => !defaultAttributes.includes(key)),
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm w-full">
      {orderedKeys.map((key) => {
        const value = data[key];
        const isDefault = defaultAttributes.includes(key);
        
        return (
          <React.Fragment key={key}>
            <div
              className={`${
                isDefault ? 'font-semibold' : 'text-foreground opacity-95'
              } break-words`}
            >
              {key}:
            </div>
            <div 
              className="whitespace-pre-wrap break-all pl-4 md:pl-0 text-muted-foreground min-w-0"
              style={{ overflowWrap: 'anywhere' }}
            >
              {typeof value === 'object'
                ? JSON.stringify(value, (_key, val) =>
                    typeof val === 'bigint' ? parseInt(val.toString()) : val
                  )
                : String(value)}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function ArrayViewer({ 
  data, 
  defaultAttributes = [] 
}: { 
  data: Record<string, unknown>[];
  defaultAttributes?: string[];
}) {
  return (
    <div className="flex flex-col gap-3">
      {data.map((item, index) => (
        <div
          key={index}
          className="border rounded-md p-4"
        >
          <ObjectViewer data={item} defaultAttributes={defaultAttributes} />
        </div>
      ))}
    </div>
  );
}

export function MetaNetCDFButtons({
  variables,
  attributes,
  metadata,
}: Props) {
  return (
        <ButtonGroup className="glow-effect">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="cursor-pointer">
                Variables
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-[800px] max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Variables</DialogTitle>
                <DialogDescription>
                  View all variables in the NetCDF file
                </DialogDescription>
              </DialogHeader>
              <ObjectViewer data={variables} />
              <DialogClose asChild>
                <Button variant="outline" className="mt-4 cursor-pointer">Close</Button>
              </DialogClose>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="cursor-pointer">
                Global Attributes
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-[800px] max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Global Attributes</DialogTitle>
                <DialogDescription>
                  View all global attributes in the NetCDF file
                </DialogDescription>
              </DialogHeader>
              <ObjectViewer data={attributes} />
              <DialogClose asChild>
                <Button variant="outline" className="mt-4 cursor-pointer">Close</Button>
              </DialogClose>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="cursor-pointer">
                Full Metadata
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-[800px] max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Full Metadata</DialogTitle>
                <DialogDescription>
                  View complete metadata information
                </DialogDescription>
              </DialogHeader>
              <ArrayViewer data={metadata} />
              <DialogClose asChild>
                <Button variant="outline" className="mt-4 cursor-pointer" >Close</Button>
              </DialogClose>
            </DialogContent>
          </Dialog>
        </ButtonGroup>
  );
}