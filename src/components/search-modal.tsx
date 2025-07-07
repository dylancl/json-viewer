"use client";

import { useState, useCallback, useEffect } from "react";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchInput } from "./search-input";
import { SearchResults } from "./search-results";
import { SearchResult, JsonNode } from "@/types/json";

type SearchModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSearch: (query: string) => void;
  searchResults: SearchResult[];
  currentResultIndex?: number;
  onNavigateToResult?: (resultIndex: number) => void;
  isSearching: boolean;
  searchProgress?: { progress: number; status: string } | null;
  currentQuery?: string;
  jsonNode?: JsonNode | null;
};

export function SearchModal({
  isOpen,
  onOpenChange,
  onSearch,
  searchResults,
  currentResultIndex = 0,
  onNavigateToResult,
  isSearching,
  searchProgress,
  currentQuery = "",
  jsonNode = null,
}: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [localCurrentResultIndex, setLocalCurrentResultIndex] = useState(0);

  // Use prop value if provided, otherwise use local state
  const activeResultIndex = onNavigateToResult
    ? currentResultIndex
    : localCurrentResultIndex;

  // Sync query with external search query when modal opens
  useEffect(() => {
    if (isOpen && currentQuery && query !== currentQuery) {
      setQuery(currentQuery);
    }
  }, [isOpen, currentQuery, query]);

  // Reset local state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setLocalCurrentResultIndex(0);
    }
  }, [isOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
        return;
      }

      if (e.key === "Enter" && searchResults.length > 0) {
        e.preventDefault();
        const direction = e.shiftKey ? "up" : "down";

        if (onNavigateToResult) {
          if (direction === "up") {
            const newIndex =
              activeResultIndex === 0
                ? searchResults.length - 1
                : activeResultIndex - 1;
            onNavigateToResult(newIndex);
          } else {
            const newIndex =
              activeResultIndex === searchResults.length - 1
                ? 0
                : activeResultIndex + 1;
            onNavigateToResult(newIndex);
          }
        } else {
          if (direction === "up") {
            setLocalCurrentResultIndex((prev: number) =>
              prev === 0 ? searchResults.length - 1 : prev - 1
            );
          } else {
            setLocalCurrentResultIndex((prev: number) =>
              prev === searchResults.length - 1 ? 0 : prev + 1
            );
          }
        }
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    isOpen,
    searchResults.length,
    onOpenChange,
    activeResultIndex,
    onNavigateToResult,
  ]);

  const handleSearch = useCallback(
    (searchQuery: string) => {
      setQuery(searchQuery);
      onSearch(searchQuery);
      if (onNavigateToResult) {
        onNavigateToResult(0);
      } else {
        setLocalCurrentResultIndex(0);
      }
    },
    [onSearch, onNavigateToResult]
  );

  const handleNavigateToResult = (resultIndex: number) => {
    if (onNavigateToResult) {
      onNavigateToResult(resultIndex);
    } else {
      setLocalCurrentResultIndex(resultIndex);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] h-[95vh] p-0 gap-0 flex flex-col min-w-2xl max-w-4xl">
        <DialogHeader className="px-6 py-4 border-b border-border flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <Search className="h-5 w-5 text-primary" />
            Search JSON
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 space-y-4 flex-1 min-h-0 flex flex-col bg-background">
          <SearchInput
            onSearch={handleSearch}
            isSearching={isSearching}
            initialQuery={query}
            className="mb-4 flex-shrink-0"
            jsonNode={jsonNode}
          />

          <div className="flex-1 min-h-0 overflow-hidden">
            <SearchResults
              query={query}
              searchResults={searchResults}
              currentResultIndex={activeResultIndex}
              onNavigateToResult={handleNavigateToResult}
              isSearching={isSearching}
              searchProgress={searchProgress}
              variant="modal"
              className="h-full overflow-hidden"
            />
          </div>

          {/* Keyboard Shortcuts Help - Only show when no query */}
          {!query && (
            <div className="border-t border-border pt-4 flex-shrink-0">
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">
                    Enter
                  </kbd>
                  <span>Navigate to next result</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">
                    Shift
                  </kbd>
                  <span>+</span>
                  <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">
                    Enter
                  </kbd>
                  <span>Navigate to previous result</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">
                    Esc
                  </kbd>
                  <span>Close search</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
