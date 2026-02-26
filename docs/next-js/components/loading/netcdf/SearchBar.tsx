'use client';
import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FileText, Search } from 'lucide-react';

interface SearchResult {
  name: string;
  groupPath: string;
}

interface SearchBarProps {
  searchQuery: string;
  searchResults: SearchResult[];
  showSearchResults: boolean;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onSelectResult: (result: SearchResult) => void;
  onDismissResults: () => void;
}

export const SearchBar = ({
  searchQuery,
  searchResults,
  showSearchResults,
  onQueryChange,
  onSearch,
  onSelectResult,
  onDismissResults,
}: SearchBarProps) => {
  return (
    <div className="flex gap-1 flex-1 min-w-[180px] sm:min-w-[200px] relative">
      <Input
        placeholder="Search variables..."
        value={searchQuery}
        onChange={(e) => onQueryChange(e.target.value)}
        onFocus={() => searchResults.length > 0 && onSearch()}
        className="h-9 text-sm min-w-0"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={onSearch}
        disabled={!searchQuery.trim()}
        className="flex-shrink-0"
      >
        <Search className="h-4 w-4" />
      </Button>

      {showSearchResults && (
        <>
          <div className="fixed inset-0 z-10" onClick={onDismissResults} />
          <div className="absolute top-full left-0 right-0 sm:right-12 mt-1 bg-popover border rounded-md shadow-md max-h-[300px] overflow-y-auto z-20">
            {searchResults.length > 0 ? (
              <div className="py-1">
                {searchResults.map((result, idx) => (
                  <button
                    key={`${result.groupPath}-${result.name}-${idx}`}
                    onClick={() => onSelectResult(result)}
                    className="w-full text-left px-3 py-2 hover:bg-accent cursor-pointer transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <FileText className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm break-all">{result.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 break-all">
                          {result.groupPath}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                No variables found matching your search.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
