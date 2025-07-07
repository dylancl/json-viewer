import React, { ReactNode, useCallback } from "react";

export function useTextHighlight(
  highlightSearch: boolean,
  searchQuery: string
) {
  const highlightText = useCallback(
    (text: string): ReactNode => {
      if (!highlightSearch || !searchQuery.trim()) {
        return text;
      }

      try {
        const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`(${escapedQuery})`, "gi");
        const parts = text.split(regex);

        return parts.map((part, index) => {
          if (part.toLowerCase() === searchQuery.toLowerCase()) {
            return React.createElement(
              "span",
              {
                key: index,
                className:
                  "bg-yellow-200 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 px-1 rounded",
              },
              part
            );
          }
          return part;
        });
      } catch (error) {
        console.warn("Failed to highlight text:", error);
        return text;
      }
    },
    [highlightSearch, searchQuery]
  );

  return { highlightText };
}
