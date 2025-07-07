"use client";

import { useMemo, useCallback, useState, useEffect, useRef, memo } from "react";
import { ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchResult } from "@/types/json";
import { isValidJSONPath, validateJSONPath } from "@/lib/jsonpath-utils";

type SearchResultsProps = {
  query: string;
  searchResults: SearchResult[];
  currentResultIndex: number;
  onNavigateToResult: (resultIndex: number) => void;
  isSearching: boolean;
  searchProgress?: { progress: number; status: string } | null;
  className?: string;
  variant?: "panel" | "modal";
};

export const SearchResults = memo(function SearchResults({
  query,
  searchResults,
  currentResultIndex = 0,
  onNavigateToResult,
  isSearching,
  searchProgress,
  className,
  variant = "panel",
}: SearchResultsProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const selectedResultRef = useRef<HTMLDivElement>(null);

  const resultsPerPage = variant === "modal" ? 20 : 10;
  const totalPages = Math.ceil(searchResults.length / resultsPerPage);

  // Reset to first page when search results change
  const pageStartIndex = currentPage * resultsPerPage;
  const pageEndIndex = Math.min(
    pageStartIndex + resultsPerPage,
    searchResults.length
  );
  const currentPageResults = searchResults.slice(pageStartIndex, pageEndIndex);
  const navigateResults = useCallback(
    (direction: "up" | "down") => {
      if (searchResults.length === 0) return;

      let newIndex: number;
      if (direction === "up") {
        newIndex =
          currentResultIndex === 0
            ? searchResults.length - 1
            : currentResultIndex - 1;
      } else {
        newIndex =
          currentResultIndex === searchResults.length - 1
            ? 0
            : currentResultIndex + 1;
      }

      // Calculate which page the new index should be on
      const newPage = Math.floor(newIndex / resultsPerPage);
      if (newPage !== currentPage) {
        setCurrentPage(newPage);
      }

      onNavigateToResult(newIndex);
    },
    [
      searchResults.length,
      currentResultIndex,
      onNavigateToResult,
      resultsPerPage,
      currentPage,
    ]
  );

  const navigateToPage = useCallback(
    (page: number) => {
      if (page >= 0 && page < totalPages) {
        setCurrentPage(page);
        // If current result is not on the new page, navigate to the first result of the new page
        const newPageStartIndex = page * resultsPerPage;
        if (
          currentResultIndex < newPageStartIndex ||
          currentResultIndex >= newPageStartIndex + resultsPerPage
        ) {
          onNavigateToResult(newPageStartIndex);
        }
      }
    },
    [totalPages, resultsPerPage, currentResultIndex, onNavigateToResult]
  );

  // Update current page when currentResultIndex changes externally
  const requiredPage = Math.floor(currentResultIndex / resultsPerPage);
  if (requiredPage !== currentPage && searchResults.length > 0) {
    setCurrentPage(requiredPage);
  }

  // Reset pagination when search results change
  useEffect(() => {
    setCurrentPage(0);
  }, [searchResults.length, query]);

  // Scroll to selected result when currentResultIndex changes
  useEffect(() => {
    if (selectedResultRef.current) {
      selectedResultRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [currentResultIndex]);

  // Scroll to selected result when currentResultIndex changes
  useEffect(() => {
    if (selectedResultRef.current) {
      selectedResultRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [currentResultIndex]);

  // Memoize the results text to prevent unnecessary re-renders
  const resultsText = useMemo(() => {
    if (!query.trim()) return "";

    const trimmedQuery = query.trim();
    const isJsonPathQuery = trimmedQuery.startsWith("$");

    // Show helpful text for incomplete JSONPath queries
    if (isJsonPathQuery && !isValidJSONPath(trimmedQuery)) {
      const validation = validateJSONPath(trimmedQuery);
      if (trimmedQuery.length < 3) {
        return "Continue typing JSONPath expression...";
      }
      return validation.error || "Invalid JSONPath expression";
    }

    if (isSearching && searchProgress) {
      if (searchResults.length > 0) {
        return `${searchProgress.status} (${searchResults.length} found so far)`;
      }
      return `${searchProgress.status} (${searchProgress.progress}%)`;
    }
    if (isSearching) {
      if (searchResults.length > 0) {
        return `Searching... (${searchResults.length} found so far)`;
      }
      return "Searching...";
    }
    if (searchResults.length === 0) return "No results found";
    return `${currentResultIndex + 1} of ${searchResults.length} results`;
  }, [
    query,
    isSearching,
    searchProgress,
    searchResults.length,
    currentResultIndex,
  ]);

  const getResultIcon = useCallback((type: string) => {
    switch (type) {
      case "key":
        return "🔑";
      case "value":
        return "📄";
      case "jsonpath":
        return "🎯";
      default:
        return "📍";
    }
  }, []);

  // Memoize the search results display to prevent unnecessary re-renders during progress updates
  const searchResultsDisplay = useMemo(() => {
    if (searchResults.length === 0) {
      // Show empty state only if we have a query and aren't searching
      if (query && !isSearching) {
        return (
          <div className="text-center py-12">
            <div className="text-muted-foreground mb-2">
              <div className="text-lg font-medium mb-2">No results found</div>
              <div className="text-sm">
                Try searching for different keywords or check your spelling
              </div>
            </div>
          </div>
        );
      }
      return null;
    }

    const scrollAreaClass = variant === "modal" ? "h-full" : "max-h-48";

    // For modal variant, show all results with proper scrolling
    // For panel variant, use pagination
    const resultsToShow =
      variant === "modal" ? searchResults : currentPageResults;

    return (
      <ScrollArea className={scrollAreaClass}>
        <div className={`space-y-2 ${variant === "modal" ? "pr-2" : ""}`}>
          {resultsToShow.map((result, index) => {
            // For modal: use direct index, for panel: use global index
            const globalIndex =
              variant === "modal" ? index : pageStartIndex + index;
            return (
              <div
                key={`${result.path.join("-")}-${globalIndex}`}
                ref={
                  globalIndex === currentResultIndex ? selectedResultRef : null
                }
                className={`
                  ${
                    variant === "modal" ? "p-4" : "p-3"
                  } rounded-lg border cursor-pointer transition-all duration-200
                  hover:bg-accent/70 animate-in slide-in-from-top-2 fade-in-0
                  ${
                    globalIndex === currentResultIndex
                      ? "bg-primary/10 border-primary/40 ring-1 ring-primary/20"
                      : "border-border hover:border-accent"
                  }
                `}
                onClick={() => onNavigateToResult(globalIndex)}
              >
                {/* Path - Improved layout for long paths */}
                <div
                  className={`font-mono text-xs text-muted-foreground ${
                    variant === "modal" ? "mb-3" : "mb-2"
                  }`}
                >
                  {result.path.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1 leading-relaxed">
                      <span className="text-primary font-semibold">root</span>
                      {result.path.map((segment, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <span className="text-muted-foreground">→</span>
                          <span
                            className="text-foreground break-all"
                            title={segment} // Show full text on hover
                          >
                            {segment}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-primary font-semibold">root</span>
                  )}
                </div>

                {/* Match Info - Improved layout */}
                <div className="flex items-start gap-3">
                  <span
                    className={
                      variant === "modal"
                        ? "text-lg mt-0.5"
                        : "text-sm mt-0.5 flex-shrink-0"
                    }
                  >
                    {getResultIcon(result.matchType)}
                  </span>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`
                          px-2 py-1 rounded-full text-xs font-medium flex-shrink-0
                          ${
                            result.matchType === "key"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                              : result.matchType === "jsonpath"
                              ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                          }
                        `}
                      >
                        {result.matchType === "jsonpath"
                          ? "JSONPath"
                          : result.matchType}
                      </span>
                    </div>

                    {/* Value/Expression Display - Better wrapping */}
                    {result.matchType === "jsonpath" &&
                      result.pathExpression && (
                        <div className="font-mono text-xs text-muted-foreground break-all bg-muted/50 p-2 rounded">
                          {result.pathExpression}
                        </div>
                      )}

                    {result.matchType !== "jsonpath" && (
                      <div className="font-mono text-xs text-foreground break-all bg-muted/50 p-2 rounded">
                        {result.matchType === "key"
                          ? `"${result.key}"`
                          : (() => {
                              const valueStr = String(result.value);
                              const maxLength = variant === "modal" ? 200 : 100;
                              return valueStr.length > maxLength
                                ? valueStr.substring(0, maxLength) + "..."
                                : valueStr;
                            })()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    );
  }, [
    searchResults,
    currentResultIndex,
    onNavigateToResult,
    isSearching,
    getResultIcon,
    query,
    variant,
    currentPageResults,
    pageStartIndex,
  ]);

  // Don't render anything if there's no query
  if (!query.trim()) return null;

  return (
    <div
      className={`border border-border rounded-lg bg-card/50 ${
        variant === "modal" ? "h-full flex flex-col" : ""
      } ${className}`}
    >
      <div
        className={`p-4 space-y-3 ${
          variant === "modal" ? "flex-1 flex flex-col min-h-0" : ""
        }`}
      >
        {/* Search Status and Navigation */}
        <div className="flex items-center justify-between gap-4 flex-shrink-0">
          <div className="text-sm text-foreground font-medium flex-1 min-w-0">
            {resultsText}
          </div>

          {/* Pagination Controls - Only for panel variant */}
          {variant === "panel" && totalPages > 1 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateToPage(currentPage - 1)}
                disabled={currentPage === 0}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-2 py-1 bg-muted rounded text-xs font-mono">
                {currentPage + 1} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateToPage(currentPage + 1)}
                disabled={currentPage === totalPages - 1}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Navigation Controls */}
          {searchResults.length > 0 && (
            <div className="flex items-center border rounded-lg">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateResults("up")}
                disabled={searchResults.length <= 1}
                className="h-8 w-8 p-0 rounded-r-none border-r"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateResults("down")}
                disabled={searchResults.length <= 1}
                className="h-8 w-8 p-0 rounded-l-none"
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Results Summary */}
        {searchResults.length > 0 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground flex-shrink-0">
            <span>
              {variant === "modal"
                ? `${searchResults.length} results total`
                : `Showing results ${pageStartIndex + 1}-${pageEndIndex} of ${
                    searchResults.length
                  }`}
            </span>
            {isSearching && (
              <span className="text-primary animate-pulse">
                Still searching...
              </span>
            )}
          </div>
        )}

        {/* Progress Bar - Only show for longer searches to prevent flickering */}
        {isSearching && searchProgress && (
          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden flex-shrink-0 animate-in fade-in-50 duration-300">
            <div
              className="bg-primary h-1.5 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${searchProgress.progress}%` }}
            />
          </div>
        )}

        {/* Search Results */}
        <div className={variant === "modal" ? "flex-1 min-h-0" : ""}>
          {searchResultsDisplay}
        </div>
      </div>
    </div>
  );
});
