'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

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

export function MetaNetCDFAccordion({
  variables,
  attributes,
  metadata,
}: Props) {
  return (
    <Accordion
      type="single"
      collapsible
      className="w-full"
      // defaultValue="variables"
    >
      <AccordionItem value="variables">
        <AccordionTrigger>Variables</AccordionTrigger>
        <AccordionContent>
          <ObjectViewer data={variables} />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="attributes">
        <AccordionTrigger>Global Attributes</AccordionTrigger>
        <AccordionContent>
          <ObjectViewer data={attributes} />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="metadata">
        <AccordionTrigger>Full Metadata</AccordionTrigger>
        <AccordionContent>
          <ArrayViewer data={metadata} />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
