"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Search, X, Loader2, Code2, HelpCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Toggle } from "@/components/ui/toggle";
import { getJSONPathExamples, validateJSONPath } from "@/lib/jsonpath-utils";
import { JSONPathAutocomplete } from "@/components/jsonpath-autocomplete";
import { JsonNode } from "@/types/json";

type SearchInputProps = {
  onSearch: (query: string) => void;
  isSearching: boolean;
  className?: string;
  initialQuery?: string;
  jsonNode?: JsonNode | null;
};

export function SearchInput({
  onSearch,
  isSearching,
  className,
  initialQuery = "",
  jsonNode = null,
}: SearchInputProps) {
  const [query, setQuery] = useState(initialQuery);
  const [isJsonPathMode, setIsJsonPathMode] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wasInputFocusedRef = useRef(false);

  // Memoize validation result to prevent unnecessary re-renders
  const validationResult = useMemo(() => {
    if (
      !isJsonPathMode ||
      !query.trim().startsWith("$") ||
      query.trim().length < 2
    ) {
      return { isValid: true, isPartiallyValid: true };
    }
    return validateJSONPath(query.trim());
  }, [query, isJsonPathMode]);

  // Memoize the input class name to prevent re-renders
  const inputClassName = useMemo(() => {
    if (!validationResult.isPartiallyValid) {
      return "ring-2 ring-red-500 focus:ring-red-500";
    } else if (!validationResult.isValid) {
      return "ring-2 ring-orange-500 focus:ring-orange-500";
    }
    return "";
  }, [validationResult]);

  // Track if input was focused to maintain focus during re-renders
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const handleFocus = () => {
      wasInputFocusedRef.current = true;
    };

    const handleBlur = () => {
      // Use a small delay to prevent immediate blur from interfering with re-focus
      setTimeout(() => {
        if (document.activeElement !== input) {
          wasInputFocusedRef.current = false;
        }
      }, 50);
    };

    input.addEventListener("focus", handleFocus);
    input.addEventListener("blur", handleBlur);

    return () => {
      input.removeEventListener("focus", handleFocus);
      input.removeEventListener("blur", handleBlur);
    };
  }, [isJsonPathMode]);

  // Restore focus when component re-renders if it was previously focused
  useEffect(() => {
    if (
      wasInputFocusedRef.current &&
      inputRef.current &&
      document.activeElement !== inputRef.current &&
      !isJsonPathMode
    ) {
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      });
    }
  });

  // Update internal state if initialQuery changes (for external control)
  useEffect(() => {
    if (initialQuery !== query) {
      setQuery(initialQuery);
    }
  }, [initialQuery, query]);

  const handleSearch = useCallback(
    (searchQuery: string) => {
      setQuery(searchQuery);
      onSearch(searchQuery);
    },
    [onSearch]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      handleSearch(value);
    },
    [handleSearch]
  );

  const clearSearch = useCallback(() => {
    setQuery("");
    onSearch("");
    // Keep focus on input after clearing
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    });
  }, [onSearch]);

  return (
    <div className={`border border-border rounded-lg bg-card/50 ${className}`}>
      <div className="p-4 space-y-3">
        {/* Search Input */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2 z-10">
              {isSearching ? (
                <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
              ) : (
                <Search className="h-4 w-4 text-muted-foreground" />
              )}
            </div>

            {isJsonPathMode && jsonNode ? (
              <JSONPathAutocomplete
                value={query}
                onChange={handleSearch}
                onSubmit={onSearch}
                jsonNode={jsonNode}
                placeholder="Enter JSONPath expression (e.g., $.store.book[*].author)"
                className={inputClassName}
                disabled={isSearching}
                autoFocus
              />
            ) : (
              <Input
                ref={inputRef}
                type="text"
                placeholder="Search keys and values..."
                value={query}
                onChange={handleInputChange}
                className="pl-10 pr-10 border-0 bg-background/60 focus:bg-background transition-colors"
                autoComplete="off"
                spellCheck="false"
                autoFocus
              />
            )}

            {query && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSearch}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-accent z-10"
                onMouseDown={(e) => {
                  // Prevent input from losing focus when clicking clear button
                  e.preventDefault();
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* JSONPath Mode Toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Toggle
                  pressed={isJsonPathMode}
                  onPressedChange={setIsJsonPathMode}
                  className="h-8 px-2"
                  aria-label="Toggle JSONPath mode"
                  onMouseDown={(e) => {
                    // Prevent input from losing focus when toggling
                    e.preventDefault();
                  }}
                >
                  <Code2 className="h-4 w-4" />
                </Toggle>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {isJsonPathMode
                    ? "Switch to text search"
                    : "Switch to JSONPath mode"}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* JSONPath Help */}
          {isJsonPathMode && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowExamples(!showExamples)}
                    className="h-8 w-8 p-0"
                    onMouseDown={(e) => {
                      // Prevent input from losing focus when clicking help
                      e.preventDefault();
                    }}
                  >
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Show JSONPath examples</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* JSONPath Examples */}
        {isJsonPathMode && showExamples && (
          <div className="p-3 bg-muted/30 border border-border/50 rounded-lg">
            <h4 className="text-sm font-medium text-foreground mb-2">
              JSONPath Examples:
            </h4>
            <div className="grid grid-cols-1 gap-1.5 text-xs">
              {getJSONPathExamples()
                .slice(0, 6)
                .map((example, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      handleSearch(example.expression);
                      // Refocus input after clicking example
                      setTimeout(() => {
                        if (inputRef.current) {
                          inputRef.current.focus();
                        }
                      }, 0);
                    }}
                    onMouseDown={(e) => {
                      // Prevent input from losing focus when clicking examples
                      e.preventDefault();
                    }}
                    className="text-left p-2 rounded-md bg-background/80 hover:bg-background transition-colors border border-border/50 hover:border-border"
                  >
                    <div className="font-mono text-primary">
                      {example.expression}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {example.description}
                    </div>
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Search Status - Only show JSONPath validation */}
        {query &&
          isJsonPathMode &&
          query.trim().startsWith("$") &&
          query.trim().length >= 2 && (
            <div className="flex items-center justify-between">
              {!validationResult.isPartiallyValid && validationResult.error ? (
                <div className="text-xs text-red-500">
                  Error: {validationResult.error}
                  {validationResult.suggestion && (
                    <div className="text-orange-500 mt-1">
                      Suggestion: {validationResult.suggestion}
                    </div>
                  )}
                </div>
              ) : !validationResult.isValid && validationResult.error ? (
                <div className="text-xs text-orange-500">
                  {validationResult.error}
                  {validationResult.suggestion && (
                    <div className="text-muted-foreground mt-1">
                      {validationResult.suggestion}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
      </div>
    </div>
  );
}
