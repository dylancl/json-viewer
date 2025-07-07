"use client";

import { useState } from "react";
import { SearchInput } from "./search-input";
import { SearchResults } from "./search-results";
import { SearchResult, JsonNode } from "@/types/json";

type SearchPanelProps = {
  onSearch: (query: string) => void;
  searchResults: SearchResult[];
  currentResultIndex?: number;
  onNavigateToResult?: (resultIndex: number) => void;
  isSearching: boolean;
  searchProgress?: { progress: number; status: string } | null;
  className?: string;
  jsonNode?: JsonNode | null;
};

export function SearchPanel({
  onSearch,
  searchResults,
  currentResultIndex = 0,
  onNavigateToResult,
  isSearching,
  searchProgress,
  className,
  jsonNode = null,
}: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [localCurrentResultIndex, setLocalCurrentResultIndex] = useState(0);

  // Use prop value if provided, otherwise use local state
  const activeResultIndex = onNavigateToResult
    ? currentResultIndex
    : localCurrentResultIndex;

  const handleSearch = (searchQuery: string) => {
    setQuery(searchQuery);
    onSearch(searchQuery);
    if (onNavigateToResult) {
      onNavigateToResult(0);
    } else {
      setLocalCurrentResultIndex(0);
    }
  };

  const handleNavigateToResult = (resultIndex: number) => {
    if (onNavigateToResult) {
      onNavigateToResult(resultIndex);
    } else {
      setLocalCurrentResultIndex(resultIndex);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <SearchInput
        onSearch={handleSearch}
        isSearching={isSearching}
        initialQuery={query}
        jsonNode={jsonNode}
      />

      <SearchResults
        query={query}
        searchResults={searchResults}
        currentResultIndex={activeResultIndex}
        onNavigateToResult={handleNavigateToResult}
        isSearching={isSearching}
        searchProgress={searchProgress}
      />
    </div>
  );
}
