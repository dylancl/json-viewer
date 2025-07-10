import { useState, useCallback, useRef } from 'react';
import {
  JsonNode,
  JsonViewerConfig,
  SearchResult,
  JsonStats,
} from '@/types/json';
import {
  createJsonNode,
  calculateJsonStats,
  searchInJsonAsync,
  searchInJson,
} from '@/lib/json-utils';
import { JsonWorkerManager } from '@/lib/json-worker-manager';
import {
  expandPathsInNode,
  resetNodeExpansion,
  setAllNodesExpanded,
  getPathsToExpand,
  toggleNodeAtPath,
} from '@/lib/json-node-utils';
import { useDebouncedSearch } from './use-debounced-search';
import { useWorkerManager } from './use-worker-manager';
import { useProgressState } from './use-progress-state';
import { useThemeManager } from './use-theme-manager';
import { useScrollToElement } from './use-scroll-to-element';

const DEFAULT_CONFIG: JsonViewerConfig = {
  viewMode: 'tree',
  showLineNumbers: false,
  showDataTypes: true,
  highlightSearch: true,
  collapseLevel: 2,
  theme: 'auto',
  enableVirtualization: true,
  virtualizationThreshold: 10000,
};

export function useJsonViewer() {
  const [jsonNode, setJsonNode] = useState<JsonNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [stats, setStats] = useState<JsonStats | null>(null);
  const [currentSearchResultIndex, setCurrentSearchResultIndex] = useState(0);
  const [config, setConfig] = useState<JsonViewerConfig>(DEFAULT_CONFIG);
  const [selectedPath, setSelectedPath] = useState<string[] | null>(null);

  const originalJsonStringRef = useRef<string>('');
  const currentSearchRef = useRef<string>('');

  const worker = useWorkerManager();
  const {
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
  } = useProgressState();
  const { scrollToElement } = useScrollToElement();

  useThemeManager(config.theme);

  const clearSearchState = useCallback(() => {
    setSearchResults([]);
    setCurrentSearchResultIndex(0);
    finishSearching();
  }, [finishSearching]);

  const expandPathsToResults = useCallback((results: SearchResult[]) => {
    if (results.length === 0) return;

    const expandPaths = () => {
      setJsonNode((prevNode) => {
        if (!prevNode) return null;
        const pathsToExpand = getPathsToExpand(results);
        return expandPathsInNode(prevNode, pathsToExpand);
      });
    };

    if (window.requestIdleCallback) {
      window.requestIdleCallback(expandPaths);
    } else {
      setTimeout(expandPaths, 0);
    }
  }, []);

  const performSearch = useCallback(
    async (query: string, searchId: string) => {
      if (!jsonNode) return;

      const trimmedQuery = query.trim();
      const isJsonPathQuery = trimmedQuery.startsWith('$');
      const isComplexQuery = isJsonPathQuery;

      startSearching();
      clearSearchState();

      try {
        const shouldUseWorker = JsonWorkerManager.shouldUseWorker(
          originalJsonStringRef.current,
          stats,
          isComplexQuery
        );

        if (shouldUseWorker && worker) {
          const useRawJson =
            originalJsonStringRef.current &&
            originalJsonStringRef.current.length > 1000000;

          const resultHandler = (result: SearchResult) => {
            if (currentSearchRef.current === searchId) {
              setSearchResults((prev) => {
                const newResults = [...prev, result];
                if (newResults.length <= 5) {
                  expandPathsToResults([result]);
                }
                return newResults;
              });
            }
          };

          const progressHandler = (progress: number, status: string) => {
            if (currentSearchRef.current === searchId) {
              updateSearchProgress(progress, status);
            }
          };

          if (useRawJson) {
            await worker.searchStreamWithRawJson(
              originalJsonStringRef.current,
              query,
              resultHandler,
              progressHandler
            );
          } else {
            await worker.searchStream(
              jsonNode,
              query,
              resultHandler,
              progressHandler
            );
          }
        } else {
          const shouldUseAsync = stats && stats.totalValues > 5000;

          if (shouldUseAsync) {
            const results = await searchInJsonAsync(
              jsonNode,
              query,
              (progress, status) => {
                if (currentSearchRef.current === searchId) {
                  updateSearchProgress(progress, status);
                }
              }
            );

            if (currentSearchRef.current === searchId) {
              setSearchResults(results);
              if (results.length > 0) {
                expandPathsToResults(results);
              }
            }
          } else {
            const results = searchInJson(jsonNode, query);

            if (currentSearchRef.current === searchId) {
              setSearchResults(results);
              if (results.length > 0) {
                expandPathsToResults(results);
              }
            }
          }
        }

        if (currentSearchRef.current === searchId) {
          finishSearching();
        }
      } catch (err) {
        if (currentSearchRef.current === searchId) {
          const errorMessage =
            err instanceof Error ? err.message : 'Unknown error';
          setSearchError(errorMessage);
          setSearchResults([]);
        }
      }
    },
    [
      jsonNode,
      stats,
      worker,
      startSearching,
      clearSearchState,
      expandPathsToResults,
      updateSearchProgress,
      finishSearching,
      setSearchError,
    ]
  );

  const { debouncedCallback: debouncedSearch, cancelPending } =
    useDebouncedSearch(
      async (query: string) => {
        const searchId = Math.random().toString(36);
        currentSearchRef.current = searchId;
        await performSearch(query, searchId);
      },
      (args) => {
        const [query] = args;
        const isJsonPathQuery = query.trim().startsWith('$');
        return isJsonPathQuery ? 400 : 100;
      }
    );

  const parseJson = useCallback(
    async (jsonString: string) => {
      startLoading();
      setError(null);

      try {
        originalJsonStringRef.current = jsonString;

        if (JsonWorkerManager.shouldUseWorker(jsonString) && worker) {
          const node = await worker.parseJson(
            jsonString,
            updateLoadingProgress
          );
          setJsonNode(node);

          updateLoadingProgress(100, 'Calculating statistics...');
          const calculatedStats = await worker.calculateStats(node);
          setStats(calculatedStats);
        } else {
          updateLoadingProgress(10, 'Parsing JSON...');

          const parseResult = await import('@/lib/json-utils').then((utils) =>
            utils.parseJsonSafely(jsonString)
          );

          if (!parseResult.success || parseResult.data === undefined) {
            throw new Error(parseResult.error || 'Failed to parse JSON');
          }

          updateLoadingProgress(50, 'Creating node tree...');
          const node = createJsonNode(parseResult.data);
          setJsonNode(node);

          updateLoadingProgress(90, 'Calculating statistics...');
          const calculatedStats = calculateJsonStats(node);
          setStats(calculatedStats);
        }

        finishLoading();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse JSON');
        finishLoading();
      }
    },
    [worker, startLoading, updateLoadingProgress, finishLoading]
  );

  const searchJson = useCallback(
    async (query: string) => {
      if (!jsonNode) {
        clearSearchState();
        return;
      }

      cancelPending();
      setSearchQuery(query);

      if (!query.trim()) {
        clearSearchState();
        setJsonNode((prevNode) =>
          prevNode ? resetNodeExpansion(prevNode) : null
        );
        return;
      }

      const trimmedQuery = query.trim();
      const isJsonPathQuery = trimmedQuery.startsWith('$');

      if (
        isJsonPathQuery &&
        (trimmedQuery.length < 3 || !trimmedQuery.includes('.'))
      ) {
        clearSearchState();
        return;
      }

      debouncedSearch(query);
    },
    [jsonNode, cancelPending, clearSearchState, debouncedSearch]
  );

  const navigateToSearchResult = useCallback(
    (resultIndex: number) => {
      if (resultIndex < 0 || resultIndex >= searchResults.length) return;

      setCurrentSearchResultIndex(resultIndex);
      const result = searchResults[resultIndex];

      expandPathsToResults([result]);

      // For virtualized trees, we need to trigger a scroll event
      // The scrolling will be handled by the VirtualizedJsonTree component
      const pathId = `json-node-${result.path.join('-')}`;

      // Try to scroll using the existing scroll mechanism
      scrollToElement(pathId);

      // Emit a custom event for virtualized tree to handle
      window.dispatchEvent(
        new CustomEvent('scrollToSearchResult', {
          detail: { path: result.path, resultIndex },
        })
      );
    },
    [searchResults, expandPathsToResults, scrollToElement]
  );

  const toggleNode = useCallback((path: string[]) => {
    setJsonNode((prevNode) =>
      prevNode ? toggleNodeAtPath(prevNode, path) : null
    );
  }, []);

  const expandAll = useCallback(() => {
    setJsonNode((prevNode) =>
      prevNode ? setAllNodesExpanded(prevNode, true) : null
    );
  }, []);

  const collapseAll = useCallback(() => {
    setJsonNode((prevNode) =>
      prevNode ? setAllNodesExpanded(prevNode, false) : null
    );
  }, []);

  const updateConfig = useCallback((updates: Partial<JsonViewerConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const selectNode = useCallback((path: string[]) => {
    setSelectedPath(path);
  }, []);

  const clearData = useCallback(() => {
    cancelPending();
    currentSearchRef.current = '';
    originalJsonStringRef.current = '';

    setJsonNode(null);
    setError(null);
    setSearchQuery('');
    setStats(null);
    setSelectedPath(null);
    clearSearchState();
  }, [cancelPending, clearSearchState]);

  return {
    jsonNode,
    isLoading,
    error,
    searchQuery,
    searchResults,
    currentSearchResultIndex,
    stats,
    config,
    selectedPath,
    loadingProgress,
    searchProgress,
    isSearching,
    parseJson,
    searchJson,
    toggleNode,
    selectNode,
    expandAll,
    collapseAll,
    updateConfig,
    clearData,
    navigateToSearchResult,
  };
}
