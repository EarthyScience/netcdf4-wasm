"use client";
import type { RemoteFileOptions } from "@earthyscience/netcdf4-wasm";
import { Terminal } from "lucide-react";
import React, { ChangeEvent, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

interface FileLoaderProps {
  url: string;
  isLoading: boolean;
  error: string | null;
  onUrlChange: (value: string) => void;
  onFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onUrlFetch: (options: RemoteFileOptions) => void;
}

// One "Name: value" header per line
const parseHeaders = (text: string): Record<string, string> =>
  Object.fromEntries(
    text
      .split("\n")
      .map((line) => line.split(/:(.*)/).map((part) => part.trim()))
      .filter(([name]) => name)
      .map(([name, value = ""]) => [name, value]),
  );

export const FileLoader = ({
  url,
  isLoading,
  error,
  onUrlChange,
  onFileSelect,
  onUrlFetch,
}: FileLoaderProps) => {
  const [headers, setHeaders] = useState("");
  const [withCredentials, setWithCredentials] = useState(false);
  const fetchUrl = () =>
    onUrlFetch({ headers: parseHeaders(headers), withCredentials });

  return (
    <>
      <Input
        id="netcdf-file"
        type="file"
        onChange={onFileSelect}
        disabled={isLoading}
        className="cursor-pointer w-full"
      />

      <Field>
        <ButtonGroup className="w-full">
          <Input
            placeholder="http:// or https://"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchUrl()}
            disabled={isLoading}
            className="min-w-0"
          />
          <Button
            variant="outline"
            onClick={fetchUrl}
            disabled={isLoading}
            className="flex-shrink-0 cursor-pointer"
          >
            Fetch
          </Button>
        </ButtonGroup>

        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            Request options
          </summary>
          <div className="flex flex-col gap-2 mt-2">
            <span className="text-xs text-muted-foreground">
              Headers, one per line as Name: value
            </span>
            <textarea
              placeholder={
                "Authorization: Bearer <token>\nX-Custom-Header: value"
              }
              value={headers}
              onChange={(e) => setHeaders(e.target.value)}
              disabled={isLoading}
              rows={3}
              className="border-input dark:bg-input/30 w-full rounded-md border bg-transparent px-3 py-2 font-mono text-xs outline-none"
            />
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={withCredentials}
                onChange={(e) => setWithCredentials(e.target.checked)}
                disabled={isLoading}
              />
              Send cookies (withCredentials)
            </label>
          </div>
        </details>

        {isLoading && (
          <div className="flex items-center gap-2 mt-2">
            <Spinner />
            <span className="text-sm text-muted-foreground">Loading...</span>
          </div>
        )}
      </Field>

      {error && (
        <Alert variant="destructive">
          <Terminal className="h-4 w-4 flex-shrink-0" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="break-words">{error}</AlertDescription>
        </Alert>
      )}
    </>
  );
};
