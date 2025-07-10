'use client';

import React, {
  memo,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  useState,
} from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { JsonNode as JsonNodeType } from '@/types/json';

type FlatNode = {
  node: JsonNodeType;
  visible: boolean;
  level: number;
  isVirtualPlaceholder?: boolean;
};

type VirtualizedJsonTreeProps = {
  node: JsonNodeType;
  onToggle: (path: string[]) => void;
  onSelect?: (path: string[]) => void;
  selectedPath?: string[] | null;
  showDataTypes: boolean;
  showLineNumbers: boolean;
  highlightSearch: boolean;
  searchQuery: string;
  className?: string;
  height?: number;
  width?: number | string;
  itemHeight?: number;
  overscan?: number;
};

// Progressive chunk size for large datasets
const INITIAL_LOAD_SIZE = 100;
const CHUNK_SIZE = 50;

// Flatten the tree structure into a list of visible nodes with progressive loading
function flattenJsonTreeProgressive(
  node: JsonNodeType,
  level: number = 0,
  result: FlatNode[] = [],
  loadedChunks: Map<string, number> = new Map()
): FlatNode[] {
  // Add current node
  result.push({
    node,
    visible: true,
    level,
    isVirtualPlaceholder: false,
  });

  // If node is expanded and has children
  if (node.isExpanded && node.children && node.children.length > 0) {
    const nodeKey = node.path.join('.');
    const loadedCount = loadedChunks.get(nodeKey) || INITIAL_LOAD_SIZE;
    const childrenToShow = Math.min(loadedCount, node.children.length);

    // Add visible children
    for (let i = 0; i < childrenToShow; i++) {
      const child = node.children[i];
      flattenJsonTreeProgressive(child, level + 1, result, loadedChunks);
    }

    // Add "load more" placeholder if there are more items
    if (childrenToShow < node.children.length) {
      const remainingCount = node.children.length - childrenToShow;
      const loadMoreNode: JsonNodeType = {
        key: 'load-more',
        value: `Load ${Math.min(
          CHUNK_SIZE,
          remainingCount
        )} more items (${remainingCount} remaining)`,
        type: 'string',
        path: [...node.path, 'load-more'],
        depth: level + 1,
        isExpanded: false,
      };

      result.push({
        node: loadMoreNode,
        visible: true,
        level: level + 1,
        isVirtualPlaceholder: true,
      });
    }
  }

  return result;
}

// Simple flattening for smaller datasets
function flattenJsonTree(
  node: JsonNodeType,
  level: number = 0,
  result: FlatNode[] = []
): FlatNode[] {
  result.push({
    node,
    visible: true,
    level,
    isVirtualPlaceholder: false,
  });

  if (node.isExpanded && node.children && node.children.length > 0) {
    for (const child of node.children) {
      flattenJsonTree(child, level + 1, result);
    }
  }

  return result;
}

// Simplified node renderer for virtualized list - doesn't recursively render children
const VirtualizedNodeRenderer = memo(
  ({
    node,
    level,
    onToggle,
    onSelect,
    selectedPath,
    showDataTypes,
    showLineNumbers,
    highlightSearch,
    searchQuery,
  }: {
    node: JsonNodeType;
    level: number;
    onToggle: (path: string[]) => void;
    onSelect?: (path: string[]) => void;
    selectedPath?: string[] | null;
    showDataTypes: boolean;
    showLineNumbers: boolean;
    highlightSearch: boolean;
    searchQuery: string;
  }) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpandable = node.type === 'object' || node.type === 'array';
    const paddingLeft = showLineNumbers ? level * 24 + 48 : level * 24 + 8;

    // Check if this node is currently selected
    const isSelected =
      selectedPath &&
      selectedPath.length === node.path.length &&
      selectedPath.every((segment, index) => segment === node.path[index]);

    const handleToggle = useCallback(() => {
      if (isExpandable) {
        onToggle(node.path);
      }
    }, [isExpandable, onToggle, node.path]);

    const handleSelect = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onSelect) {
          onSelect(node.path);
        }
      },
      [onSelect, node.path]
    );

    const renderValue = () => {
      if (node.type === 'string') {
        return `"${node.value}"`;
      }
      if (node.type === 'object') {
        return hasChildren ? `{${node.children?.length || 0} items}` : '{}';
      }
      if (node.type === 'array') {
        return hasChildren ? `[${node.children?.length || 0} items]` : '[]';
      }
      return String(node.value);
    };

    const getTypeColor = () => {
      switch (node.type) {
        case 'string':
          return 'text-green-600 dark:text-green-400';
        case 'number':
          return 'text-blue-600 dark:text-blue-400';
        case 'boolean':
          return 'text-purple-600 dark:text-purple-400';
        case 'null':
          return 'text-gray-500 dark:text-gray-400';
        case 'object':
          return 'text-orange-600 dark:text-orange-400';
        case 'array':
          return 'text-indigo-600 dark:text-indigo-400';
        default:
          return 'text-foreground';
      }
    };

    const highlightText = (text: string) => {
      if (!highlightSearch || !searchQuery) return text;
      const regex = new RegExp(`(${searchQuery})`, 'gi');
      return text.replace(
        regex,
        '<mark class="bg-yellow-200 dark:bg-yellow-700">$1</mark>'
      );
    };

    return (
      <div
        className={`
        flex items-center gap-2 p-2 rounded-lg group
        transition-all duration-200 ease-in-out
        hover:bg-accent/60 hover:shadow-sm
        cursor-pointer
        min-h-[2.5rem]
        ${isSelected ? 'bg-primary/20 border-2 border-primary/50' : ''}
      `}
        style={{ paddingLeft: `${paddingLeft}px` }}
        onClick={(e) => {
          if (isExpandable) {
            handleToggle();
          }
          handleSelect(e);
        }}
      >
        <div className="w-4 h-4 flex items-center justify-center shrink-0">
          {isExpandable &&
            (node.isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            ))}
        </div>

        <div className="flex-1 min-w-0 flex items-center gap-2">
          {node.key !== undefined && (
            <>
              <span className="font-semibold text-foreground">
                <span
                  dangerouslySetInnerHTML={{
                    __html: highlightText(String(node.key)),
                  }}
                />
              </span>
              <span className="text-muted-foreground">:</span>
            </>
          )}

          <span className={`font-mono text-sm ${getTypeColor()}`}>
            <span
              dangerouslySetInnerHTML={{ __html: highlightText(renderValue()) }}
            />
          </span>

          {showDataTypes && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-secondary text-secondary-foreground">
              {node.type}
            </span>
          )}
        </div>
      </div>
    );
  }
);

VirtualizedNodeRenderer.displayName = 'VirtualizedNodeRenderer';

const VirtualizedTreeItem = memo(
  ({ index, style, data }: ListChildComponentProps) => {
    const {
      flatNodes,
      onToggle,
      onSelect,
      selectedPath,
      onLoadMore,
      showDataTypes,
      showLineNumbers,
      highlightSearch,
      searchQuery,
    } = data;

    const flatNode = flatNodes[index];

    const handleClick = useCallback(() => {
      if (flatNode?.isVirtualPlaceholder) {
        onLoadMore(flatNode.node.path.slice(0, -1));
      } else if (flatNode) {
        onToggle(flatNode.node.path);
      }
    }, [flatNode, onToggle, onLoadMore]);

    if (!flatNode) {
      return <div style={style} className="h-10" />;
    }

    if (flatNode.isVirtualPlaceholder) {
      return (
        <div style={style}>
          <div
            className="flex items-center gap-2 p-2 ml-12 cursor-pointer hover:bg-accent/60 rounded-lg text-sm text-blue-600 dark:text-blue-400"
            onClick={handleClick}
          >
            <span className="font-medium">📄 {flatNode.node.value}</span>
          </div>
        </div>
      );
    }

    return (
      <div style={style}>
        <VirtualizedNodeRenderer
          node={flatNode.node}
          level={flatNode.level}
          onToggle={onToggle}
          onSelect={onSelect}
          selectedPath={selectedPath}
          showDataTypes={showDataTypes}
          showLineNumbers={showLineNumbers}
          highlightSearch={highlightSearch}
          searchQuery={searchQuery}
        />
      </div>
    );
  }
);

VirtualizedTreeItem.displayName = 'VirtualizedTreeItem';

export const VirtualizedJsonTree = memo(
  ({
    node,
    onToggle,
    onSelect,
    selectedPath,
    showDataTypes,
    showLineNumbers,
    highlightSearch,
    searchQuery,
    className,
    height,
    width = '100%',
    itemHeight = 40,
    overscan = 5,
  }: VirtualizedJsonTreeProps) => {
    const listRef = useRef<List>(null);
    const [loadedChunks, setLoadedChunks] = useState<Map<string, number>>(
      new Map()
    );
    const [useProgressive, setUseProgressive] = useState(false);

    // Simple height - use provided height or default to 80vh
    const listHeight = height || Math.floor(window.innerHeight * 0.8);

    // Count total nodes to determine if we need progressive loading
    const totalNodesCount = useMemo(() => {
      const countNodes = (n: JsonNodeType): number => {
        let count = 1;
        if (n.children) {
          count += n.children.reduce(
            (acc, child) => acc + countNodes(child),
            0
          );
        }
        return count;
      };
      return countNodes(node);
    }, [node]);

    // Determine if we should use progressive loading
    useEffect(() => {
      setUseProgressive(totalNodesCount > 1000);
    }, [totalNodesCount]);

    // Flatten the tree structure for virtualization
    const flatNodes = useMemo(() => {
      const startTime = performance.now();

      let result: FlatNode[];
      if (useProgressive) {
        result = flattenJsonTreeProgressive(node, 0, [], loadedChunks);
      } else {
        result = flattenJsonTree(node);
      }

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      console.log(
        `Tree flattening took ${processingTime.toFixed(2)}ms for ${
          result.length
        } nodes`
      );

      return result;
    }, [node, loadedChunks, useProgressive]);

    // Listen for search navigation events
    useEffect(() => {
      const handleScrollToSearchResult = (event: CustomEvent) => {
        const { path } = event.detail;
        const targetIndex = flatNodes.findIndex(
          (flatNode) => flatNode.node.path.join('.') === path.join('.')
        );

        if (targetIndex !== -1 && listRef.current) {
          listRef.current.scrollToItem(targetIndex, 'center');
        }
      };

      window.addEventListener(
        'scrollToSearchResult',
        handleScrollToSearchResult as EventListener
      );
      return () => {
        window.removeEventListener(
          'scrollToSearchResult',
          handleScrollToSearchResult as EventListener
        );
      };
    }, [flatNodes]);

    // Handle loading more items for a specific parent node
    const handleLoadMore = useCallback((parentPath: string[]) => {
      const nodeKey = parentPath.join('.');
      setLoadedChunks((prev) => {
        const newMap = new Map(prev);
        const currentLoaded = newMap.get(nodeKey) || INITIAL_LOAD_SIZE;
        newMap.set(nodeKey, currentLoaded + CHUNK_SIZE);
        return newMap;
      });
    }, []);

    // Enhanced toggle handler
    const enhancedToggle = useCallback(
      (path: string[]) => {
        onToggle(path);
      },
      [onToggle]
    );

    const itemData = useMemo(
      () => ({
        flatNodes,
        onToggle: enhancedToggle,
        onSelect,
        selectedPath,
        onLoadMore: handleLoadMore,
        showDataTypes,
        showLineNumbers,
        highlightSearch,
        searchQuery,
      }),
      [
        flatNodes,
        enhancedToggle,
        onSelect,
        selectedPath,
        handleLoadMore,
        showDataTypes,
        showLineNumbers,
        highlightSearch,
        searchQuery,
      ]
    );

    return (
      <div className={`virtualized-json-tree flex flex-col ${className}`}>
        {useProgressive && (
          <div className="mb-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-sm text-blue-700 dark:text-blue-300 flex-shrink-0">
            ⚡ Virtual scrolling active - Large dataset detected (
            {totalNodesCount} total nodes). Items load progressively for optimal
            performance.
          </div>
        )}

        <div className="flex-1">
          <List
            ref={listRef}
            height={listHeight}
            width={width}
            itemCount={flatNodes.length}
            itemSize={itemHeight}
            itemData={itemData}
            overscanCount={overscan}
            className="virtualized-list"
          >
            {VirtualizedTreeItem}
          </List>
        </div>

        {flatNodes.length === 0 && (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            No data to display
          </div>
        )}

        <div className="mt-2 text-xs text-muted-foreground flex-shrink-0">
          Showing {flatNodes.length} visible nodes
          {useProgressive && ` of ${totalNodesCount} total`}
        </div>
      </div>
    );
  }
);

VirtualizedJsonTree.displayName = 'VirtualizedJsonTree';
