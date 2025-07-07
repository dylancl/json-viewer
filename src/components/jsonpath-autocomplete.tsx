"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import {
  getJSONPathAutocompleteSuggestions,
  JSONPathAutocompleteSuggestion,
} from "@/lib/jsonpath-utils";
import { JsonNode } from "@/types/json";

interface JSONPathAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  jsonNode: JsonNode | null;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function JSONPathAutocomplete({
  value,
  onChange,
  onSubmit,
  jsonNode,
  placeholder = "Enter JSONPath expression (e.g., $.store.book[*].author)",
  className = "",
  disabled = false,
  autoFocus = false,
}: JSONPathAutocompleteProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<
    JSONPathAutocompleteSuggestion[]
  >([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [isFocused, setIsFocused] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Maintain focus across re-renders if the component was focused
  useEffect(() => {
    if (
      isFocused &&
      inputRef.current &&
      document.activeElement !== inputRef.current
    ) {
      requestAnimationFrame(() => {
        if (inputRef.current && isFocused) {
          inputRef.current.focus();
        }
      });
    }
  });

  // Handle focus and blur events
  const handleFocus = useCallback(() => {
    setIsFocused(true);
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  }, [suggestions.length]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    // Check if blur is due to clicking on suggestions
    if (
      suggestionsRef.current &&
      suggestionsRef.current.contains(e.relatedTarget as Node)
    ) {
      // Don't blur if clicking on suggestions
      return;
    }
    setIsFocused(false);
    setShowSuggestions(false);
  }, []);

  // Update suggestions when input changes
  const updateSuggestions = useCallback(() => {
    if (!jsonNode || !value) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const newSuggestions = getJSONPathAutocompleteSuggestions(
      value,
      jsonNode,
      cursorPosition
    );

    setSuggestions(newSuggestions);
    setShowSuggestions(newSuggestions.length > 0);
    setSelectedIndex(-1);
  }, [value, jsonNode, cursorPosition]);

  useEffect(() => {
    updateSuggestions();
  }, [updateSuggestions]);

  // Handle cursor position changes
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      const newCursorPosition = e.target.selectionStart || 0;

      onChange(newValue);
      setCursorPosition(newCursorPosition);
    },
    [onChange]
  );

  // Handle cursor movement
  const handleInputSelect = useCallback(() => {
    if (inputRef.current) {
      setCursorPosition(inputRef.current.selectionStart || 0);
    }
  }, []);

  // Apply suggestion with smart dot insertion
  const applySuggestion = useCallback(
    (suggestion: JSONPathAutocompleteSuggestion) => {
      if (!inputRef.current) return;

      const currentValue = value;
      const beforeCursor = currentValue.substring(0, cursorPosition);
      const afterCursor = currentValue.substring(cursorPosition);

      // Smart dot insertion: add dot if the suggestion is a property and we're not already at a dot context
      let insertText = suggestion.insertText;
      const isPropertySuggestion =
        suggestion.label.includes("(object)") ||
        suggestion.label.includes("(array)");
      const needsDot =
        isPropertySuggestion &&
        !beforeCursor.endsWith(".") &&
        !insertText.startsWith(".") &&
        !insertText.startsWith("[");

      if (needsDot) {
        insertText += ".";
      }

      // Insert the suggestion text at cursor position
      const newValue = beforeCursor + insertText + afterCursor;

      // Calculate new cursor position
      const newCursorPos =
        cursorPosition + insertText.length + (suggestion.cursorOffset || 0);

      // Store the cursor position to restore after onChange
      const targetCursorPosition = newCursorPos;

      // Keep focus state
      setIsFocused(true);
      onChange(newValue);
      setShowSuggestions(false);

      // Use a more reliable method to maintain focus and cursor position
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.setSelectionRange(
            targetCursorPosition,
            targetCursorPosition
          );
          setCursorPosition(targetCursorPosition);
        }
      });
    },
    [value, cursorPosition, onChange]
  );

  // Scroll to selected item in dropdown
  const scrollToSelected = useCallback(() => {
    if (suggestionsRef.current && selectedIndex >= 0) {
      const selectedElement = suggestionsRef.current.children[
        selectedIndex
      ] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
      }
    }
  }, [selectedIndex]);

  useEffect(() => {
    scrollToSelected();
  }, [scrollToSelected]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showSuggestions || suggestions.length === 0) {
        if (e.key === "Enter" && onSubmit) {
          onSubmit(value);
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : suggestions.length - 1
          );
          break;
        case "Enter":
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
            applySuggestion(suggestions[selectedIndex]);
          } else if (onSubmit) {
            onSubmit(value);
          }
          break;
        case "Escape":
          e.preventDefault();
          setShowSuggestions(false);
          setSelectedIndex(-1);
          break;
        case "Tab":
          if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
            e.preventDefault();
            applySuggestion(suggestions[selectedIndex]);
          }
          break;
      }
    },
    [
      showSuggestions,
      suggestions,
      selectedIndex,
      applySuggestion,
      onSubmit,
      value,
    ]
  );

  // Prevent focus loss when clicking on suggestions
  const handleSuggestionMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // Hide suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
        setIsFocused(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full">
      <Input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onSelect={handleInputSelect}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={`pl-10 pr-10 border-0 bg-background/60 focus:bg-background transition-colors ${className}`}
        autoComplete="off"
        spellCheck="false"
        autoFocus={autoFocus}
      />

      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-y-auto"
          onMouseDown={handleSuggestionMouseDown}
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-accent focus:bg-accent border-none outline-none transition-colors ${
                index === selectedIndex ? "bg-accent" : ""
              }`}
              onClick={() => applySuggestion(suggestion)}
              onMouseEnter={() => setSelectedIndex(index)}
              data-suggestion-index={index}
            >
              <div className="font-mono text-primary text-sm">
                {suggestion.label}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {suggestion.description}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
