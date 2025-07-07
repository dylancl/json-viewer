import { useState, useCallback, useRef } from "react";

export interface ProgressState {
  progress: number;
  status: string;
}

export function useProgressState() {
  const [loadingProgress, setLoadingProgress] = useState<ProgressState | null>(
    null
  );
  const [searchProgress, setSearchProgress] = useState<ProgressState | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Throttle progress updates to prevent excessive re-renders
  const lastProgressUpdateRef = useRef<number>(0);
  const progressTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const startLoading = useCallback(() => {
    setIsLoading(true);
    setLoadingProgress(null);
  }, []);

  const updateLoadingProgress = useCallback(
    (progress: number, status: string) => {
      setLoadingProgress({ progress, status });
    },
    []
  );

  const finishLoading = useCallback(() => {
    setIsLoading(false);
    setLoadingProgress({ progress: 100, status: "Complete" });
    setTimeout(() => setLoadingProgress(null), 1000);
  }, []);

  const startSearching = useCallback(() => {
    setIsSearching(true);
    setSearchProgress({ progress: 0, status: "Starting search..." });
    lastProgressUpdateRef.current = Date.now();
  }, []);

  const updateSearchProgress = useCallback(
    (progress: number, status: string) => {
      const now = Date.now();

      // Throttle updates to prevent excessive re-renders
      // Allow immediate updates for 0%, 100%, or every 100ms
      if (
        progress === 0 ||
        progress === 100 ||
        now - lastProgressUpdateRef.current >= 100
      ) {
        setSearchProgress({ progress, status });
        lastProgressUpdateRef.current = now;

        // Clear any pending timeout
        if (progressTimeoutRef.current) {
          clearTimeout(progressTimeoutRef.current);
          progressTimeoutRef.current = undefined;
        }
      } else {
        // Debounce intermediate updates
        if (progressTimeoutRef.current) {
          clearTimeout(progressTimeoutRef.current);
        }

        progressTimeoutRef.current = setTimeout(() => {
          setSearchProgress({ progress, status });
          lastProgressUpdateRef.current = Date.now();
          progressTimeoutRef.current = undefined;
        }, 50);
      }
    },
    []
  );

  const finishSearching = useCallback(() => {
    setIsSearching(false);

    // Clear any pending timeout
    if (progressTimeoutRef.current) {
      clearTimeout(progressTimeoutRef.current);
      progressTimeoutRef.current = undefined;
    }

    // Add a small delay before clearing progress to prevent flickering
    setTimeout(() => setSearchProgress(null), 150);
  }, []);

  const setSearchError = useCallback((error: string) => {
    // Clear any pending timeout
    if (progressTimeoutRef.current) {
      clearTimeout(progressTimeoutRef.current);
      progressTimeoutRef.current = undefined;
    }

    setSearchProgress({
      progress: 100,
      status: `Search failed: ${error}`,
    });
    setIsSearching(false);
    setTimeout(() => setSearchProgress(null), 3000);
  }, []);

  return {
    loadingProgress,
    searchProgress,
    isLoading,
    isSearching,
    startLoading,
    updateLoadingProgress,
    finishLoading,
    startSearching,
    updateSearchProgress,
    finishSearching,
    setSearchError,
  };
}
