"use client";

import { useState } from "react";
import { FileInput } from "@/components/file-input";
import { JsonTreeViewer } from "@/components/json-tree-viewer";
import { Button } from "@/components/ui/button";
import { Plus, Zap, Search, Eye } from "lucide-react";

export default function JsonViewerApp() {
  const [jsonContent, setJsonContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileLoad = async (content: string) => {
    setIsLoading(true);
    setJsonContent(content);
    setIsLoading(false);
  };

  const handleTextInput = async (text: string) => {
    setIsLoading(true);
    setJsonContent(text);
    setIsLoading(false);
  };

  const handleNewFile = () => {
    setJsonContent(null);
  };

  if (!jsonContent) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-12 px-4">
          <div className="max-w-3xl mx-auto">
            {/* Hero Section */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-6">
                <Zap className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-5xl font-bold text-foreground mb-4 tracking-tight">
                JSON Viewer
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                A high-performance, beautiful JSON viewer designed for large
                files with advanced search and navigation
              </p>
            </div>

            <FileInput
              onFileLoad={handleFileLoad}
              onTextInput={handleTextInput}
              isLoading={isLoading}
            />

            {/* Features Section */}
            <div className="mt-12">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-6 rounded-xl bg-card border border-border">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-100 dark:bg-emerald-900/20 rounded-lg mb-4">
                    <Zap className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">
                    High Performance
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Web Workers handle large files seamlessly without blocking
                    the UI
                  </p>
                </div>
                <div className="text-center p-6 rounded-xl bg-card border border-border">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg mb-4">
                    <Search className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">
                    Smart Search
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Advanced search with highlighting and navigation through
                    results
                  </p>
                </div>
                <div className="text-center p-6 rounded-xl bg-card border border-border">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg mb-4">
                    <Eye className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">
                    Multiple Views
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Tree, raw, and formatted views with customizable display
                    options
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background">
      <div className="h-full">
        <JsonTreeViewer initialJsonContent={jsonContent} />

        {/* Floating New File Button */}
        <Button
          onClick={handleNewFile}
          className="fixed bottom-6 right-6 shadow-lg hover:shadow-xl transition-all duration-200 z-50"
          size="lg"
        >
          <Plus className="w-4 h-4" />
          New File
        </Button>
      </div>
    </div>
  );
}
