'use client';

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

function ObjectViewer({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="flex flex-col rounded-md border p-2">
          <span className="font-medium">{key}</span>
          <span className="text-muted-foreground break-all">
            {typeof value === 'object'
              ? JSON.stringify(value, (_key, val) =>
                typeof val === 'bigint' ? parseInt(val.toString()) : val)
              : String(value)
            }
          </span>
        </div>
      ))}
    </div>
  );
}

function ArrayViewer({ data }: { data: Record<string, unknown>[] }) {
  return (
    <div className="flex flex-col gap-3">
      {data.map((item, index) => (
        <div
          key={index}
          className="border rounded-md p-2 flex flex-col gap-1"
        >
          <span className="font-medium">Item {index + 1}</span>
          <ObjectViewer data={item} />
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
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
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
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
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
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
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