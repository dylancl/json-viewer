'use client';

import { useEffect, useState, useCallback } from 'react';
import { JsonNode } from '@/components/json-node';
import { VirtualizedJsonTree } from '@/components/virtualized-json-tree';
import { JsonFormatter } from '@/components/json-formatter';
import { SearchModal } from '@/components/search-modal';
import { StatsPanel } from '@/components/stats-panel';
import { JsonPathIndicator } from '@/components/json-path-indicator';
import { Toolbar } from '@/components/toolbar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { Card } from '@/components/ui/card';
import { Loader2, AlertTriangle, FileX } from 'lucide-react';
import { useJsonViewer } from '@/hooks/use-json-viewer';

type JsonTreeViewerProps = {
  initialJsonContent?: string;
  className?: string;
};

export function JsonTreeViewer({
  initialJsonContent,
  className,
}: JsonTreeViewerProps) {
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const {
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
  } = useJsonViewer();

  // Detect theme changes
  useEffect(() => {
    const checkTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };

    // Check initial theme
    checkTheme();

    // Watch for theme changes
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  const handleSearchModalChange = useCallback((open: boolean) => {
    setIsSearchModalOpen(open);
    // Don't clear search when modal is closed - keep results for highlighting
  }, []);

  // Parse the initial JSON content when component mounts
  useEffect(() => {
    if (initialJsonContent && !jsonNode) {
      parseJson(initialJsonContent);
    }
  }, [initialJsonContent, jsonNode, parseJson]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-64 space-y-6">
          <div className="relative">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="absolute inset-0 h-12 w-12 rounded-full border-2 border-primary/20"></div>
          </div>
          {loadingProgress ? (
            <div className="text-center space-y-3 max-w-sm">
              <div className="text-foreground font-medium text-lg">
                {loadingProgress.status}
              </div>
              <div className="w-80 bg-muted rounded-full h-3 overflow-hidden">
                <div
                  className="bg-primary h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${loadingProgress.progress}%` }}
                />
              </div>
              <div className="text-sm text-muted-foreground">
                {loadingProgress.progress}% complete
              </div>
            </div>
          ) : (
            <span className="text-foreground text-lg">Processing JSON...</span>
          )}
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <div className="p-4 bg-destructive/10 rounded-full">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <div className="text-center max-w-md">
            <div className="text-destructive text-lg font-semibold mb-2">
              Parsing Error
            </div>
            <div className="text-foreground">{error}</div>
          </div>
        </div>
      );
    }

    if (!jsonNode) {
      return (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <div className="p-4 bg-muted rounded-full">
            <FileX className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-foreground mb-2">
              No JSON Data
            </div>
            <div className="text-muted-foreground">
              Upload a file or paste JSON text to get started
            </div>
          </div>
        </div>
      );
    }

    switch (config.viewMode) {
      case 'tree':
        // Determine if we should use virtualization
        const shouldVirtualize =
          config.enableVirtualization &&
          stats &&
          stats.totalValues > config.virtualizationThreshold;

        if (shouldVirtualize) {
          return (
            <div className="group w-full h-full">
              <VirtualizedJsonTree
                node={jsonNode}
                onToggle={toggleNode}
                onSelect={selectNode}
                selectedPath={selectedPath}
                showDataTypes={config.showDataTypes}
                showLineNumbers={config.showLineNumbers}
                highlightSearch={config.highlightSearch}
                searchQuery={searchQuery}
                className="min-w-fit"
              />
            </div>
          );
        } else {
          return (
            <div className="group w-full">
              <div className="w-full overflow-x-auto">
                <JsonNode
                  node={jsonNode}
                  onToggle={toggleNode}
                  onSelect={selectNode}
                  selectedPath={selectedPath}
                  showDataTypes={config.showDataTypes}
                  showLineNumbers={config.showLineNumbers}
                  highlightSearch={config.highlightSearch}
                  searchQuery={searchQuery}
                  className="min-w-fit"
                />
              </div>
            </div>
          );
        }

      case 'raw':
        return (
          <pre className="text-sm font-mono whitespace-pre-wrap break-words text-foreground leading-relaxed p-4">
            {JSON.stringify(jsonNode.value)}
          </pre>
        );

      case 'formatted':
        return (
          <div className="h-[calc(100vh-200px)] min-h-[500px] w-full">
            <JsonFormatter jsonValue={jsonNode.value} isDarkMode={isDarkMode} />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`h-full flex flex-col bg-background ${className}`}>
      <Toolbar
        config={config}
        onConfigChange={updateConfig}
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
        onClear={clearData}
        jsonData={jsonNode?.value as object}
        onOpenSearch={() => setIsSearchModalOpen(true)}
      />

      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Main Content */}
          <ResizablePanel defaultSize={70} minSize={30}>
            <div className="h-full flex flex-col">
              {/* JSON Content */}
              <div className="flex-1 min-h-0 bg-muted/30">
                <ScrollArea className="h-full w-full scrollbar-thin">
                  <Card className="m-3 min-h-[calc(100vh-140px)] border-border">
                    <div className="p-4">{renderContent()}</div>
                  </Card>
                </ScrollArea>
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle className="w-2 bg-border hover:bg-border/80 transition-colors" />

          {/* Side Panel */}
          <ResizablePanel defaultSize={30} minSize={20}>
            <div className="h-full p-4 bg-muted/30 space-y-4">
              <JsonPathIndicator selectedPath={selectedPath} />
              <StatsPanel stats={stats} />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Search Modal */}
      <SearchModal
        isOpen={isSearchModalOpen}
        onOpenChange={handleSearchModalChange}
        onSearch={searchJson}
        searchResults={searchResults}
        currentResultIndex={currentSearchResultIndex}
        onNavigateToResult={navigateToSearchResult}
        isSearching={isSearching}
        searchProgress={searchProgress}
        currentQuery={searchQuery}
        jsonNode={jsonNode}
      />
    </div>
  );
}
