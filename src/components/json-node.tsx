'use client';

import { memo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Copy,
  Braces,
  Brackets,
  Check,
} from 'lucide-react';
import { JsonNode as JsonNodeType } from '@/types/json';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  useClipboard,
  useJsonNodeDisplay,
  useJsonNodeStyling,
  useLineNumbers,
  useTextHighlight,
  usePerformanceOptimization,
} from '@/hooks';

type JsonNodeProps = {
  node: JsonNodeType;
  onToggle: (path: string[]) => void;
  onSelect?: (path: string[]) => void;
  selectedPath?: string[] | null;
  showDataTypes: boolean;
  showLineNumbers: boolean;
  highlightSearch: boolean;
  searchQuery: string;
  className?: string;
};

const JsonNodeWrapper = memo((props: JsonNodeProps) => {
  const lineNumbers = useLineNumbers(props.node, props.showLineNumbers);
  const { shouldRenderChildren, childrenToRender, isLargeDataset } =
    usePerformanceOptimization(props.node, props.node.isExpanded ?? false);

  return (
    <TooltipProvider>
      <JsonNodeComponent
        {...props}
        lineNumbers={lineNumbers}
        shouldRenderChildren={shouldRenderChildren}
        childrenToRender={childrenToRender}
        isLargeDataset={isLargeDataset}
      />
    </TooltipProvider>
  );
});
JsonNodeWrapper.displayName = 'JsonNodeWrapper';

type JsonNodeComponentProps = JsonNodeProps & {
  lineNumbers: Map<string, number>;
  shouldRenderChildren?: boolean;
  childrenToRender?: number;
  isLargeDataset?: boolean;
};

function JsonNodeComponent({
  node,
  onToggle,
  onSelect,
  selectedPath,
  showDataTypes,
  showLineNumbers,
  highlightSearch,
  searchQuery,
  className,
  lineNumbers,
  shouldRenderChildren = true,
  childrenToRender = 0,
  isLargeDataset = false,
}: JsonNodeComponentProps) {
  const { copied, copy } = useClipboard();
  const valueInfo = useJsonNodeDisplay(node);
  const { typeColor, typeBadgeColor } = useJsonNodeStyling(node);
  const { highlightText } = useTextHighlight(highlightSearch, searchQuery);

  const hasChildren = node.children && node.children.length > 0;
  const isExpandable = node.type === 'object' || node.type === 'array';
  const pathKey = node.path.join('-');
  const currentLineNumber = lineNumbers.get(pathKey) || 0;

  // Check if this node is currently selected
  const isSelected =
    selectedPath &&
    selectedPath.length === node.path.length &&
    selectedPath.every((segment, index) => segment === node.path[index]);

  const handleToggle = () => {
    if (isExpandable) {
      onToggle(node.path);
    }
  };

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelect) {
      onSelect(node.path);
    }
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await copy(JSON.stringify(node.value, null, 2));
  };

  const renderValue = () => {
    const content = (
      <span className="break-all whitespace-pre-wrap">
        {highlightText(valueInfo.display)}
      </span>
    );

    if (valueInfo.isTruncated) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help">{content}</span>
          </TooltipTrigger>
          <TooltipContent
            className="max-w-md break-all bg-popover text-popover-foreground border border-border p-3"
            side="bottom"
            align="start"
          >
            <div className="font-mono text-xs whitespace-pre-wrap">
              {valueInfo.full}
            </div>
          </TooltipContent>
        </Tooltip>
      );
    }

    return content;
  };

  const paddingLeft = showLineNumbers
    ? node.depth * 24 + 48
    : node.depth * 24 + 8;

  const connectionLineLeft = showLineNumbers
    ? node.depth * 24 + 56
    : node.depth * 24 + 16;

  return (
    <div
      className={`json-node relative ${className}`}
      id={`json-node-${pathKey}`}
    >
      <div
        className={`
          flex items-start gap-2 p-2 rounded-lg group
          transition-all duration-200 ease-in-out
          hover:bg-accent/60 hover:shadow-sm
          ${isExpandable ? 'cursor-pointer' : 'cursor-pointer'}
          ${isSelected ? 'bg-primary/20 border-2 border-primary/50' : ''}
          min-h-[2.5rem] relative
        `}
        style={{ paddingLeft: `${paddingLeft}px` }}
        onClick={(e) => {
          if (isExpandable) {
            handleToggle();
          }
          handleSelect(e);
        }}
      >
        {showLineNumbers && (
          <div className="w-8 text-right text-xs text-muted-foreground/80 font-mono shrink-0 absolute left-2 top-2.5 select-none">
            {currentLineNumber}
          </div>
        )}

        <div className="w-4 h-4 flex items-center justify-center shrink-0 mt-0.5">
          {isExpandable &&
            (node.isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors duration-200" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors duration-200" />
            ))}
        </div>

        <div className="w-4 h-4 flex items-center justify-center shrink-0 mt-0.5">
          {node.type === 'object' && (
            <Braces className="h-3.5 w-3.5 text-orange-500 dark:text-orange-400" />
          )}
          {node.type === 'array' && (
            <Brackets className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
          )}
        </div>

        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          {node.key !== undefined && (
            <div className="flex items-center gap-1 min-w-0">
              <span className="font-semibold text-foreground break-all">
                {highlightText(`${node.key}`)}
              </span>
              <span className="text-muted-foreground shrink-0">:</span>
            </div>
          )}

          <div
            className={`${typeColor} font-mono text-sm leading-relaxed min-w-0 flex-1`}
          >
            {renderValue()}
          </div>

          {showDataTypes && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${typeBadgeColor}`}
            >
              {node.type}
            </span>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className={`
            opacity-0 group-hover:opacity-100 h-8 w-8 p-0 shrink-0
            transition-all duration-200 hover:bg-accent
            ${copied ? 'opacity-100' : ''}
          `}
          title={copied ? 'Copied!' : 'Copy value'}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {isExpandable &&
        node.isExpanded &&
        hasChildren &&
        shouldRenderChildren && (
          <div className="relative">
            <div
              className="absolute w-px bg-border/60 opacity-70"
              style={{
                left: `${connectionLineLeft}px`,
                top: '0',
                height: 'calc(100% - 2rem)',
              }}
            />

            <div className="space-y-0.5">
              {node
                .children!.slice(0, childrenToRender || node.children!.length)
                .map((child, index) => (
                  <JsonNodeComponent
                    key={`${child.path.join('.')}-${index}`}
                    node={child}
                    onToggle={onToggle}
                    onSelect={onSelect}
                    selectedPath={selectedPath}
                    showDataTypes={showDataTypes}
                    showLineNumbers={showLineNumbers}
                    highlightSearch={highlightSearch}
                    searchQuery={searchQuery}
                    lineNumbers={lineNumbers}
                    shouldRenderChildren={shouldRenderChildren}
                  />
                ))}

              {isLargeDataset &&
                childrenToRender &&
                childrenToRender < node.children!.length && (
                  <div
                    className="flex items-center gap-2 text-muted-foreground text-sm py-2 ml-12 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-4"
                    style={{ marginLeft: `${paddingLeft}px` }}
                  >
                    <div className="text-amber-600 dark:text-amber-400">
                      ⚠️ Showing {childrenToRender} of {node.children!.length}{' '}
                      items.
                      <span className="ml-2 text-xs opacity-80">
                        Large datasets are partially rendered for performance
                      </span>
                    </div>
                  </div>
                )}
            </div>

            <div
              className="flex items-center gap-2 text-muted-foreground font-mono text-sm py-2 relative"
              style={{ paddingLeft: `${paddingLeft}px` }}
            >
              {showLineNumbers && (
                <div className="w-8 text-right text-xs text-muted-foreground/80 font-mono shrink-0 absolute left-2 select-none">
                  {lineNumbers.get(`${pathKey}-closing`) || 0}
                </div>
              )}
              <div className="w-4 h-4" />
              <div className="w-4 h-4" />
              <span className="font-semibold text-base">
                {node.type === 'object' ? '}' : ']'}
              </span>
            </div>
          </div>
        )}

      {isExpandable &&
        node.isExpanded &&
        hasChildren &&
        !shouldRenderChildren && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-2 ml-12">
            <div className="text-amber-600 dark:text-amber-400">
              ⚠️ Large dataset - expand individual nodes to view content
            </div>
          </div>
        )}
    </div>
  );
}

export const JsonNode = memo(JsonNodeWrapper);
