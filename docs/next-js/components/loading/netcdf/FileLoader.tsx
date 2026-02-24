'use client';
import React, { ChangeEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';

interface FileLoaderProps {
  url: string;
  isLoading: boolean;
  error: string | null;
  onUrlChange: (value: string) => void;
  onFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onUrlFetch: () => void;
}

export const FileLoader = ({
  url,
  isLoading,
  error,
  onUrlChange,
  onFileSelect,
  onUrlFetch,
}: FileLoaderProps) => {
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
            placeholder="http://, https://, s3://, gs:// or ftp://"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            disabled={isLoading}
            className="min-w-0"
          />
          <Button
            variant="outline"
            onClick={onUrlFetch}
            disabled={isLoading}
            className="flex-shrink-0"
          >
            Fetch
          </Button>
        </ButtonGroup>
        <p className="text-xs text-muted-foreground mt-1 text-right">
          🆘 Help wanted: no support for remote files yet!
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
          <Terminal className="h-4 w-4 flex-shrink-0" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="break-words">{error}</AlertDescription>
        </Alert>
      )}
    </>
  );
};
