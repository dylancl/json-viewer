"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Toggle } from "@/components/ui/toggle";
import {
  Expand,
  Minimize,
  Download,
  Copy,
  Settings,
  Eye,
  Hash,
  Type,
  Search,
  FileText,
  Code,
  Trash2,
  Check,
  Sun,
  Moon,
  Monitor,
  Zap,
} from "lucide-react";
import { JsonViewerConfig, ViewMode } from "@/types/json";
import { downloadAsFile } from "@/lib/json-utils";
import { useClipboard } from "@/hooks";

type ToolbarProps = {
  config: JsonViewerConfig;
  onConfigChange: (updates: Partial<JsonViewerConfig>) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onClear: () => void;
  jsonData: object | null;
  onOpenSearch?: () => void;
  className?: string;
};

export function Toolbar({
  config,
  onConfigChange,
  onExpandAll,
  onCollapseAll,
  onClear,
  jsonData,
  onOpenSearch,
  className,
}: ToolbarProps) {
  const { copied, copy } = useClipboard();

  const handleCopyJson = async () => {
    if (!jsonData) return;

    try {
      const jsonString = JSON.stringify(jsonData, null, 2);
      await copy(jsonString);
    } catch (error) {
      console.error("Failed to copy JSON:", error);
    }
  };

  const handleDownloadJson = () => {
    if (!jsonData) return;

    try {
      const jsonString = JSON.stringify(jsonData, null, 2);
      const filename = `json-data-${
        new Date().toISOString().split("T")[0]
      }.json`;
      downloadAsFile(jsonString, filename);
    } catch (error) {
      console.error("Failed to download JSON:", error);
    }
  };

  const handleViewModeChange = (mode: ViewMode) => {
    onConfigChange({ viewMode: mode });
  };

  return (
    <div
      className={`
        flex items-center justify-between p-3 border-b border-border 
        bg-card/80 backdrop-blur-sm sticky top-0 z-10
        ${className}
      `}
    >
      <div className="flex items-center gap-3">
        {/* View Mode Selector */}
        <div className="flex items-center border border-border rounded-lg bg-background overflow-hidden">
          <Button
            variant={config.viewMode === "tree" ? "default" : "ghost"}
            size="sm"
            onClick={() => handleViewModeChange("tree")}
            className="rounded-none border-0"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Tree</span>
          </Button>
          <div className="w-px h-6 bg-border" />
          <Button
            variant={config.viewMode === "raw" ? "default" : "ghost"}
            size="sm"
            onClick={() => handleViewModeChange("raw")}
            className="rounded-none border-0"
          >
            <Code className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Raw</span>
          </Button>
          <div className="w-px h-6 bg-border" />
          <Button
            variant={config.viewMode === "formatted" ? "default" : "ghost"}
            size="sm"
            onClick={() => handleViewModeChange("formatted")}
            className="rounded-none border-0"
          >
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Formatted</span>
          </Button>
        </div>

        {/* Tree View Controls */}
        {config.viewMode === "tree" && (
          <>
            <div className="w-px h-6 bg-border" />

            {/* Search Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenSearch}
              disabled={!jsonData}
              className="text-muted-foreground hover:text-foreground hover:bg-primary/10"
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Search</span>
            </Button>

            <div className="w-px h-6 bg-border" />

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={onExpandAll}
                disabled={!jsonData}
                className="text-muted-foreground hover:text-foreground"
              >
                <Expand className="h-4 w-4" />
                <span className="hidden sm:inline ml-1">Expand</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={onCollapseAll}
                disabled={!jsonData}
                className="text-muted-foreground hover:text-foreground"
              >
                <Minimize className="h-4 w-4" />
                <span className="hidden sm:inline ml-1">Collapse</span>
              </Button>
            </div>

            <div className="w-px h-6 bg-border" />

            {/* View Options */}
            <div className="flex items-center gap-1">
              <Toggle
                pressed={config.showLineNumbers}
                onPressedChange={(pressed) =>
                  onConfigChange({ showLineNumbers: pressed })
                }
                aria-label="Toggle line numbers"
                size="sm"
                className="data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
              >
                <Hash className="h-4 w-4" />
              </Toggle>

              <Toggle
                pressed={config.showDataTypes}
                onPressedChange={(pressed) =>
                  onConfigChange({ showDataTypes: pressed })
                }
                aria-label="Toggle data types"
                size="sm"
                className="data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
              >
                <Type className="h-4 w-4" />
              </Toggle>

              <Toggle
                pressed={config.highlightSearch}
                onPressedChange={(pressed) =>
                  onConfigChange({ highlightSearch: pressed })
                }
                aria-label="Toggle search highlighting"
                size="sm"
                className="data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
              >
                <Search className="h-4 w-4" />
              </Toggle>

              <Toggle
                pressed={config.enableVirtualization}
                onPressedChange={(pressed) =>
                  onConfigChange({ enableVirtualization: pressed })
                }
                aria-label="Toggle virtualization"
                size="sm"
                className="data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
              >
                <Zap className="h-4 w-4" />
              </Toggle>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Export Options */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopyJson}
          disabled={!jsonData}
          className="text-muted-foreground hover:text-foreground"
        >
          {copied ? (
            <Check className="h-4 w-4 text-emerald-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          <span className="hidden sm:inline ml-1">
            {copied ? "Copied!" : "Copy"}
          </span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleDownloadJson}
          disabled={!jsonData}
          className="text-muted-foreground hover:text-foreground"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline ml-1">Download</span>
        </Button>

        <div className="w-px h-6 bg-border" />

        {/* Settings Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Settings</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Theme</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => onConfigChange({ theme: "light" })}
              className={config.theme === "light" ? "bg-accent" : ""}
            >
              <Sun className="h-4 w-4 mr-2" />
              Light Theme
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onConfigChange({ theme: "dark" })}
              className={config.theme === "dark" ? "bg-accent" : ""}
            >
              <Moon className="h-4 w-4 mr-2" />
              Dark Theme
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onConfigChange({ theme: "auto" })}
              className={config.theme === "auto" ? "bg-accent" : ""}
            >
              <Monitor className="h-4 w-4 mr-2" />
              Auto Theme
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Collapse Level</DropdownMenuLabel>

            <DropdownMenuItem
              onClick={() => onConfigChange({ collapseLevel: 1 })}
              className={config.collapseLevel === 1 ? "bg-accent" : ""}
            >
              Level 1
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onConfigChange({ collapseLevel: 2 })}
              className={config.collapseLevel === 2 ? "bg-accent" : ""}
            >
              Level 2
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onConfigChange({ collapseLevel: 3 })}
              className={config.collapseLevel === 3 ? "bg-accent" : ""}
            >
              Level 3
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Virtualization</DropdownMenuLabel>

            <DropdownMenuItem
              onClick={() =>
                onConfigChange({
                  enableVirtualization: !config.enableVirtualization,
                })
              }
              className={config.enableVirtualization ? "bg-accent" : ""}
            >
              <Zap className="h-4 w-4 mr-2" />
              {config.enableVirtualization ? "Disable" : "Enable"}{" "}
              Virtualization
            </DropdownMenuItem>

            <DropdownMenuLabel>Virtualization Threshold</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => onConfigChange({ virtualizationThreshold: 500 })}
              className={
                config.virtualizationThreshold === 500 ? "bg-accent" : ""
              }
            >
              500 nodes
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onConfigChange({ virtualizationThreshold: 1000 })}
              className={
                config.virtualizationThreshold === 1000 ? "bg-accent" : ""
              }
            >
              1,000 nodes
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onConfigChange({ virtualizationThreshold: 5000 })}
              className={
                config.virtualizationThreshold === 5000 ? "bg-accent" : ""
              }
            >
              5,000 nodes
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={onClear}
              className="text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All Data
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
