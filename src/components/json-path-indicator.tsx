'use client';

import { memo } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useClipboard } from '@/hooks';

type JsonPathIndicatorProps = {
  selectedPath: string[] | null;
  className?: string;
};

export const JsonPathIndicator = memo(function JsonPathIndicator({
  selectedPath,
  className = '',
}: JsonPathIndicatorProps) {
  const { copied, copy } = useClipboard();

  if (!selectedPath || selectedPath.length === 0) {
    return (
      <Card className={`p-3 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Click on a node to see its JSON path
          </div>
        </div>
      </Card>
    );
  }

  // Format the path as a JSONPath expression
  const jsonPath = selectedPath.reduce((path, segment, index) => {
    if (index === 0) return '$';

    // Check if segment is a number (array index) or string (object key)
    const isArrayIndex = /^\d+$/.test(segment);
    if (isArrayIndex) {
      return `${path}[${segment}]`;
    } else {
      // Escape keys that contain special characters
      const needsQuotes = /[^a-zA-Z0-9_]/.test(segment);
      if (needsQuotes) {
        return `${path}["${segment.replace(/"/g, '\\"')}"]`;
      } else {
        return `${path}.${segment}`;
      }
    }
  }, '');

  // Create a readable path representation
  const readablePath = selectedPath.join(' → ');

  const handleCopyPath = async () => {
    await copy(jsonPath);
  };

  const handleCopyReadablePath = async () => {
    await copy(readablePath);
  };

  return (
    <TooltipProvider>
      <Card className={`p-3 ${className}`}>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              Selected Path
            </span>
            <Badge variant="secondary" className="text-xs">
              Depth: {selectedPath.length}
            </Badge>
          </div>

          <div className="space-y-2">
            {/* JSONPath representation */}
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground mb-1">
                  JSONPath:
                </div>
                <code className="text-xs bg-muted px-2 py-1 rounded font-mono break-all block">
                  {jsonPath}
                </code>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyPath}
                    className="h-8 w-8 p-0 flex-shrink-0"
                  >
                    {copied ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Copy JSONPath</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Readable path representation */}
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground mb-1">Path:</div>
                <div className="text-xs bg-muted px-2 py-1 rounded break-all">
                  {readablePath}
                </div>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyReadablePath}
                    className="h-8 w-8 p-0 flex-shrink-0"
                  >
                    {copied ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Copy readable path</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </Card>
    </TooltipProvider>
  );
});
