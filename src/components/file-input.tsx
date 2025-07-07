"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileText, X, AlertCircle } from "lucide-react";

type FileInputProps = {
  onFileLoad: (content: string) => void;
  onTextInput: (text: string) => void;
  isLoading: boolean;
  className?: string;
};

export function FileInput({
  onFileLoad,
  onTextInput,
  isLoading,
  className,
}: FileInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [textContent, setTextContent] = useState("");

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (
        !file.name.toLowerCase().endsWith(".json") &&
        file.type !== "application/json"
      ) {
        alert("Please select a JSON file");
        return;
      }

      // Validate file size (100MB limit)
      if (file.size > 100 * 1024 * 1024) {
        alert("File is too large. Maximum size is 100MB.");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (content) {
          onFileLoad(content);
        }
      };
      reader.onerror = () => {
        alert("Failed to read file");
      };
      reader.readAsText(file);
    },
    [onFileLoad]
  );

  const handleTextSubmit = useCallback(() => {
    const text = textContent.trim();
    if (text) {
      onTextInput(text);
    }
  }, [textContent, onTextInput]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      const jsonFile = files.find(
        (file) =>
          file.name.toLowerCase().endsWith(".json") ||
          file.type === "application/json"
      );

      if (jsonFile) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          if (content) {
            onFileLoad(content);
          }
        };
        reader.readAsText(jsonFile);
      } else {
        alert("Please drop a JSON file");
      }
    },
    [onFileLoad]
  );

  const clearTextArea = useCallback(() => {
    setTextContent("");
    if (textAreaRef.current) {
      textAreaRef.current.value = "";
    }
  }, []);

  return (
    <div className={`space-y-8 ${className}`}>
      {/* File Upload */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Upload className="h-5 w-5 text-primary" />
            </div>
            Upload JSON File
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div
            className={`
              relative border-2 border-dashed rounded-xl p-12 text-center 
              transition-all duration-200 cursor-pointer group
              ${
                isDragOver
                  ? "border-primary bg-primary/5 scale-[1.02]"
                  : "border-border hover:border-primary/50 hover:bg-accent/30"
              }
              ${isLoading ? "opacity-50 cursor-not-allowed" : ""}
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isLoading && fileInputRef.current?.click()}
          >
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-muted rounded-full group-hover:bg-primary/10 transition-colors">
                <FileText className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div>
                <p className="text-lg font-medium text-foreground mb-2">
                  {isDragOver
                    ? "Drop your JSON file here"
                    : "Drop your JSON file here or click to browse"}
                </p>
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Supports files up to 100MB
                </p>
              </div>
            </div>
          </div>

          <Input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isLoading}
          />

          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            <Upload className="h-4 w-4" />
            {isLoading ? "Processing..." : "Choose File"}
          </Button>
        </CardContent>
      </Card>

      {/* Text Input */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              Paste JSON Text
            </CardTitle>
            {textContent && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearTextArea}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            ref={textAreaRef}
            placeholder="Paste your JSON content here..."
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            className="
              w-full h-48 p-4 rounded-lg border border-border 
              bg-background text-foreground placeholder:text-muted-foreground
              font-mono text-sm resize-vertical 
              focus:ring-2 focus:ring-ring focus:border-ring
              transition-all duration-200
            "
            disabled={isLoading}
          />

          <Button
            onClick={handleTextSubmit}
            disabled={isLoading || !textContent.trim()}
            className="w-full"
            size="lg"
          >
            <FileText className="h-4 w-4" />
            {isLoading ? "Processing..." : "Parse JSON"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
