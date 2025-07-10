'use client';

import { useMemo, useCallback, useState, useEffect, useRef, memo } from 'react';
import { ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SearchResult } from '@/types/json';
import { isValidJSONPath, validateJSONPath } from '@/lib/jsonpath-utils';

type SearchResultsProps = {
  query: string;
  searchResults: SearchResult[];
  currentResultIndex: number;
  onNavigateToResult: (resultIndex: number) => void;
  isSearching: boolean;
  searchProgress?: { progress: number; status: string } | null;
  className?: string;
  variant?: 'panel' | 'modal';
};

export const SearchResults = memo(function SearchResults({
  query,
  searchResults,
  currentResultIndex = 0,
  onNavigateToResult,
  isSearching,
  searchProgress,
  className,
  variant = 'panel',
}: SearchResultsProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const selectedResultRef = useRef<HTMLDivElement>(null);

  const resultsPerPage = variant === 'modal' ? 20 : 10;
  const totalPages = Math.ceil(searchResults.length / resultsPerPage);

  // Reset to first page when search results change
  const pageStartIndex = currentPage * resultsPerPage;
  const pageEndIndex = Math.min(
    pageStartIndex + resultsPerPage,
    searchResults.length
  );
  const currentPageResults = searchResults.slice(pageStartIndex, pageEndIndex);
  const navigateResults = useCallback(
    (direction: 'up' | 'down') => {
      if (searchResults.length === 0) return;

      let newIndex: number;
      if (direction === 'up') {
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
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, [currentResultIndex]);

  // Scroll to selected result when currentResultIndex changes
  useEffect(() => {
    if (selectedResultRef.current) {
      selectedResultRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, [currentResultIndex]);

  // Memoize the results text to prevent unnecessary re-renders
  const resultsText = useMemo(() => {
    if (!query.trim()) return '';

    const trimmedQuery = query.trim();
    const isJsonPathQuery = trimmedQuery.startsWith('$');

    // Show helpful text for incomplete JSONPath queries
    if (isJsonPathQuery && !isValidJSONPath(trimmedQuery)) {
      const validation = validateJSONPath(trimmedQuery);
      if (trimmedQuery.length < 3) {
        return 'Continue typing JSONPath expression...';
      }
      return validation.error || 'Invalid JSONPath expression';
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
      return 'Searching...';
    }
    if (searchResults.length === 0) return 'No results found';
    return `${currentResultIndex + 1} of ${searchResults.length} results`;
  }, [
    query,
    isSearching,
    searchProgress,
    searchResults.length,
    currentResultIndex,
  ]);

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

    const scrollAreaClass = variant === 'modal' ? 'h-full' : 'max-h-48';

    // For modal variant, show all results with proper scrolling
    // For panel variant, use pagination
    const resultsToShow =
      variant === 'modal' ? searchResults : currentPageResults;

    return (
      <ScrollArea className={scrollAreaClass}>
        <div className={`space-y-3 pt-2 ${variant === 'modal' ? 'pr-2' : ''}`}>
          {resultsToShow.map((result, index) => {
            // For modal: use direct index, for panel: use global index
            const globalIndex =
              variant === 'modal' ? index : pageStartIndex + index;
            return (
              <div
                key={`${result.path.join('-')}-${globalIndex}`}
                ref={
                  globalIndex === currentResultIndex ? selectedResultRef : null
                }
                className={`
                  group relative ${variant === 'modal' ? 'p-5' : 'p-4'} 
                  rounded-xl border cursor-pointer transition-all duration-300 ease-out
                  hover:shadow-xl hover:shadow-primary/8 hover:-translate-y-0.5
                  animate-in slide-in-from-top-2 fade-in-0
                  ${
                    globalIndex === currentResultIndex
                      ? 'bg-gradient-to-br from-primary/5 via-primary/3 to-primary/5 border-primary/30 shadow-lg shadow-primary/10 ring-1 ring-primary/20'
                      : 'bg-gradient-to-br from-card to-card/80 border-border/50 hover:border-primary/20 hover:bg-gradient-to-br hover:from-primary/3 hover:to-card/90'
                  }
                  backdrop-blur-sm
                `}
                onClick={() => onNavigateToResult(globalIndex)}
              >
                {/* Selection indicator */}
                {globalIndex === currentResultIndex && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-primary/80 to-primary rounded-r-full" />
                )}

                {/* Path breadcrumb */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500" />
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.1em] letter-spacing-wide">
                      JSON Path
                    </span>
                  </div>

                  {/* Breadcrumb container with better styling */}
                  <div className="relative">
                    {result.path.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-x-0 gap-y-2 font-mono text-xs bg-gradient-to-r from-slate-50/80 to-slate-100/60 dark:from-slate-900/40 dark:to-slate-800/30 rounded-lg border border-slate-200/60 dark:border-slate-700/50 p-2.5 backdrop-blur-sm">
                        {/* Root element */}
                        <div className="flex items-center">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 text-indigo-700 dark:text-indigo-300 font-bold rounded-md border border-indigo-200/50 dark:border-indigo-800/40 text-[11px] tracking-wide hover:from-indigo-500/15 hover:to-purple-500/15 transition-all duration-200 cursor-pointer">
                            <svg
                              className="w-3 h-3 text-indigo-500"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M4.25 2A2.25 2.25 0 002 4.25v2.5A2.25 2.25 0 004.25 9h2.5A2.25 2.25 0 009 6.75v-2.5A2.25 2.25 0 006.75 2h-2.5zm0 9A2.25 2.25 0 002 13.25v2.5A2.25 2.25 0 004.25 18h2.5A2.25 2.25 0 009 15.75v-2.5A2.25 2.25 0 006.75 11h-2.5zm9-9A2.25 2.25 0 0011 4.25v2.5A2.25 2.25 0 0013.25 9h2.5A2.25 2.25 0 0018 6.75v-2.5A2.25 2.25 0 0015.75 2h-2.5zm0 9A2.25 2.25 0 0011 13.25v2.5A2.25 2.25 0 0013.25 18h2.5A2.25 2.25 0 0018 15.75v-2.5A2.25 2.25 0 0015.75 11h-2.5z"
                                clipRule="evenodd"
                              />
                            </svg>
                            root
                          </span>
                        </div>

                        {/* Path segments */}
                        {result.path.map((segment, i) => {
                          const isLast = i === result.path.length - 1;
                          const isNumeric = !isNaN(Number(segment));

                          return (
                            <div key={i} className="flex items-center">
                              {/* Separator */}
                              <div className="mx-1.5 flex items-center">
                                <svg
                                  className="w-3 h-3 text-slate-400 dark:text-slate-500"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 5l7 7-7 7"
                                  />
                                </svg>
                              </div>

                              {/* Segment */}
                              <span
                                className={`
                                  inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[11px] font-medium tracking-wide transition-all duration-200 cursor-pointer group/segment max-w-[200px]
                                  ${
                                    isLast
                                      ? 'bg-gradient-to-r from-emerald-500/10 to-teal-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200/50 dark:border-emerald-800/40 hover:from-emerald-500/15 hover:to-teal-500/15 font-semibold'
                                      : isNumeric
                                      ? 'bg-gradient-to-r from-orange-500/8 to-amber-500/8 text-orange-700 dark:text-orange-300 border-orange-200/40 dark:border-orange-800/30 hover:from-orange-500/12 hover:to-amber-500/12'
                                      : 'bg-gradient-to-r from-slate-500/8 to-slate-600/8 text-slate-700 dark:text-slate-300 border-slate-200/40 dark:border-slate-700/30 hover:from-slate-500/12 hover:to-slate-600/12'
                                  }
                                `}
                                title={`${
                                  isNumeric ? 'Array index' : 'Object key'
                                }: ${segment}`}
                              >
                                {/* Icon for segment type */}
                                {isNumeric ? (
                                  <svg
                                    className="w-2.5 h-2.5 text-orange-500 flex-shrink-0"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M4 3a2 2 0 00-2 2v1.5h16V5a2 2 0 00-2-2H4zm14 6H2v6a2 2 0 002 2h12a2 2 0 002-2V9zM6 12a1 1 0 011-1h2a1 1 0 110 2H7a1 1 0 01-1-1zm6-1a1 1 0 100 2h2a1 1 0 100-2h-2z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                ) : (
                                  <svg
                                    className="w-2.5 h-2.5 text-slate-500 flex-shrink-0"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                )}

                                {/* Segment text with truncation */}
                                <span
                                  className="truncate min-w-0 flex-1"
                                  title={segment}
                                >
                                  {isNumeric ? `[${segment}]` : segment}
                                </span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center font-mono text-xs bg-gradient-to-r from-slate-50/80 to-slate-100/60 dark:from-slate-900/40 dark:to-slate-800/30 rounded-lg border border-slate-200/60 dark:border-slate-700/50 p-2.5 backdrop-blur-sm">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 text-indigo-700 dark:text-indigo-300 font-bold rounded-md border border-indigo-200/50 dark:border-indigo-800/40 text-[11px] tracking-wide hover:from-indigo-500/15 hover:to-purple-500/15 transition-all duration-200 cursor-pointer">
                          <svg
                            className="w-3 h-3 text-indigo-500"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M4.25 2A2.25 2.25 0 002 4.25v2.5A2.25 2.25 0 004.25 9h2.5A2.25 2.25 0 009 6.75v-2.5A2.25 2.25 0 006.75 2h-2.5zm0 9A2.25 2.25 0 002 13.25v2.5A2.25 2.25 0 004.25 18h2.5A2.25 2.25 0 009 15.75v-2.5A2.25 2.25 0 006.75 11h-2.5zm9-9A2.25 2.25 0 0011 4.25v2.5A2.25 2.25 0 0013.25 9h2.5A2.25 2.25 0 0018 6.75v-2.5A2.25 2.25 0 0015.75 2h-2.5zm0 9A2.25 2.25 0 0011 13.25v2.5A2.25 2.25 0 0013.25 18h2.5A2.25 2.25 0 0018 15.75v-2.5A2.25 2.25 0 0015.75 11h-2.5z"
                              clipRule="evenodd"
                            />
                          </svg>
                          root
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Match type badge and content */}
                <div className="space-y-4">
                  {/* Content area */}
                  <div className="space-y-3">
                    {/* JSONPath expression */}
                    {result.matchType === 'jsonpath' &&
                      result.pathExpression && (
                        <div className="relative overflow-hidden rounded-lg border border-purple-200/50 dark:border-purple-800/30">
                          <div className="bg-gradient-to-r from-purple-50/50 to-purple-100/30 dark:from-purple-900/20 dark:to-purple-900/10 px-3 py-2 border-b border-purple-200/50 dark:border-purple-800/30">
                            <span className="text-xs font-medium text-purple-700 dark:text-purple-300 uppercase tracking-wide">
                              Expression
                            </span>
                          </div>
                          <div className="p-3 font-mono text-sm text-purple-700 dark:text-purple-300 break-all bg-white/50 dark:bg-purple-950/20">
                            {result.pathExpression}
                          </div>
                        </div>
                      )}

                    {/* Key-value or value display */}
                    {result.matchType !== 'jsonpath' && (
                      <div className="relative overflow-hidden rounded-lg border border-border/50 bg-gradient-to-br from-muted/20 via-muted/10 to-muted/20">
                        {result.matchType === 'key'
                          ? (() => {
                              const valueStr = String(result.value);
                              const maxLength = variant === 'modal' ? 200 : 120;
                              const truncatedValue =
                                valueStr.length > maxLength
                                  ? valueStr.substring(0, maxLength) + '...'
                                  : valueStr;

                              // Determine value type for better styling
                              const getValueType = (val: unknown) => {
                                if (val === null) return 'null';
                                if (typeof val === 'boolean') return 'boolean';
                                if (typeof val === 'number') return 'number';
                                if (typeof val === 'string') return 'string';
                                if (Array.isArray(val)) return 'array';
                                if (typeof val === 'object') return 'object';
                                return 'unknown';
                              };

                              const valueType = getValueType(result.value);
                              const getTypeTheme = (type: string) => {
                                const themes = {
                                  string: {
                                    bg: 'from-green-50/80 to-green-100/60 dark:from-green-900/20 dark:to-green-900/10',
                                    border:
                                      'border-green-200/60 dark:border-green-800/40',
                                    text: 'text-green-700 dark:text-green-300',
                                    dot: 'bg-green-500',
                                    label: 'text-green-600 dark:text-green-400',
                                  },
                                  number: {
                                    bg: 'from-blue-50/80 to-blue-100/60 dark:from-blue-900/20 dark:to-blue-900/10',
                                    border:
                                      'border-blue-200/60 dark:border-blue-800/40',
                                    text: 'text-blue-700 dark:text-blue-300',
                                    dot: 'bg-blue-500',
                                    label: 'text-blue-600 dark:text-blue-400',
                                  },
                                  boolean: {
                                    bg: 'from-purple-50/80 to-purple-100/60 dark:from-purple-900/20 dark:to-purple-900/10',
                                    border:
                                      'border-purple-200/60 dark:border-purple-800/40',
                                    text: 'text-purple-700 dark:text-purple-300',
                                    dot: 'bg-purple-500',
                                    label:
                                      'text-purple-600 dark:text-purple-400',
                                  },
                                  null: {
                                    bg: 'from-gray-50/80 to-gray-100/60 dark:from-gray-900/20 dark:to-gray-900/10',
                                    border:
                                      'border-gray-200/60 dark:border-gray-800/40',
                                    text: 'text-gray-600 dark:text-gray-400',
                                    dot: 'bg-gray-400',
                                    label: 'text-gray-500 dark:text-gray-400',
                                  },
                                  array: {
                                    bg: 'from-orange-50/80 to-orange-100/60 dark:from-orange-900/20 dark:to-orange-900/10',
                                    border:
                                      'border-orange-200/60 dark:border-orange-800/40',
                                    text: 'text-orange-700 dark:text-orange-300',
                                    dot: 'bg-orange-500',
                                    label:
                                      'text-orange-600 dark:text-orange-400',
                                  },
                                  object: {
                                    bg: 'from-red-50/80 to-red-100/60 dark:from-red-900/20 dark:to-red-900/10',
                                    border:
                                      'border-red-200/60 dark:border-red-800/40',
                                    text: 'text-red-700 dark:text-red-300',
                                    dot: 'bg-red-500',
                                    label: 'text-red-600 dark:text-red-400',
                                  },
                                  unknown: {
                                    bg: 'from-muted/50 to-muted/30',
                                    border: 'border-muted',
                                    text: 'text-muted-foreground',
                                    dot: 'bg-muted-foreground',
                                    label: 'text-muted-foreground',
                                  },
                                };
                                return (
                                  themes[type as keyof typeof themes] ||
                                  themes.unknown
                                );
                              };

                              const theme = getTypeTheme(valueType);

                              return (
                                <div className="space-y-0">
                                  {/* Key section */}
                                  <div className="bg-gradient-to-r from-blue-50/50 to-blue-100/30 dark:from-blue-900/20 dark:to-blue-900/10 px-4 py-3 border-b border-blue-200/50 dark:border-blue-800/30">
                                    <div className="flex items-center gap-3">
                                      <div className="flex items-center gap-2 w-16">
                                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                                          Key
                                        </span>
                                      </div>
                                      <div className="font-mono text-sm font-semibold text-blue-700 dark:text-blue-300 bg-white/60 dark:bg-blue-950/30 px-3 py-1.5 rounded-md border border-blue-200/50 dark:border-blue-800/40 flex-1">
                                        &quot;{result.key}&quot;
                                      </div>
                                    </div>
                                  </div>

                                  {/* Value section */}
                                  <div
                                    className={`bg-gradient-to-r ${theme.bg} px-4 py-3`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="flex items-center gap-2 w-16">
                                        <div
                                          className={`w-2 h-2 rounded-full ${theme.dot}`}
                                        />
                                        <span
                                          className={`text-xs font-medium ${theme.label} uppercase tracking-wide`}
                                        >
                                          {valueType}
                                        </span>
                                      </div>
                                      <div
                                        className={`font-mono text-sm flex-1 ${theme.text} px-3 py-1.5 rounded-md bg-white/60 dark:bg-black/20 border ${theme.border} break-all`}
                                      >
                                        {valueType === 'string' && (
                                          <span>
                                            &quot;{truncatedValue}&quot;
                                          </span>
                                        )}
                                        {valueType === 'number' && (
                                          <span className="font-semibold">
                                            {truncatedValue}
                                          </span>
                                        )}
                                        {valueType === 'boolean' && (
                                          <span className="font-bold">
                                            {truncatedValue}
                                          </span>
                                        )}
                                        {valueType === 'null' && (
                                          <span className="italic font-medium">
                                            null
                                          </span>
                                        )}
                                        {(valueType === 'array' ||
                                          valueType === 'object') && (
                                          <span className="italic">
                                            {truncatedValue}
                                          </span>
                                        )}
                                        {valueType === 'unknown' && (
                                          <span>{truncatedValue}</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()
                          : (() => {
                              const valueStr = String(result.value);
                              const maxLength = variant === 'modal' ? 250 : 150;
                              const truncatedValue =
                                valueStr.length > maxLength
                                  ? valueStr.substring(0, maxLength) + '...'
                                  : valueStr;

                              return (
                                <div className="bg-gradient-to-r from-emerald-50/50 to-emerald-100/30 dark:from-emerald-900/20 dark:to-emerald-900/10 px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2 w-16">
                                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                                        Value
                                      </span>
                                    </div>
                                    <div className="font-mono text-sm text-emerald-700 dark:text-emerald-300 bg-white/60 dark:bg-emerald-950/20 px-3 py-2 rounded-md border border-emerald-200/50 dark:border-emerald-800/40 break-all leading-relaxed flex-1">
                                      {truncatedValue}
                                    </div>
                                  </div>
                                </div>
                              );
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
        variant === 'modal' ? 'h-full flex flex-col' : ''
      } ${className}`}
    >
      <div
        className={`p-4 space-y-3 ${
          variant === 'modal' ? 'flex-1 flex flex-col min-h-0' : ''
        }`}
      >
        {/* Search Status and Navigation */}
        <div className="flex items-center justify-between gap-4 flex-shrink-0">
          <div className="text-sm text-foreground font-medium flex-1 min-w-0">
            {resultsText}
          </div>

          {/* Pagination Controls - Only for panel variant */}
          {variant === 'panel' && totalPages > 1 && (
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
                onClick={() => navigateResults('up')}
                disabled={searchResults.length <= 1}
                className="h-8 w-8 p-0 rounded-r-none border-r"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateResults('down')}
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
              {variant === 'modal'
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
        <div className={variant === 'modal' ? 'flex-1 min-h-0' : ''}>
          {searchResultsDisplay}
        </div>
      </div>
    </div>
  );
});
