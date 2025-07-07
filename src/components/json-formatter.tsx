"use client";

import { useEffect, useState } from "react";
import { Editor } from "@monaco-editor/react";
import { formatJsonString } from "@/lib/json-utils";
import { JsonValue } from "@/types/json";

type JsonFormatterProps = {
  jsonValue: JsonValue;
  isDarkMode: boolean;
};

export function JsonFormatter({ jsonValue, isDarkMode }: JsonFormatterProps) {
  const [formattedJson, setFormattedJson] = useState("");
  const [isFormatting, setIsFormatting] = useState(false);

  // Define custom Monaco themes that match your color palette
  const setupCustomThemes = (monaco: typeof import("monaco-editor")) => {
    // Light theme matching your CSS variables
    monaco.editor.defineTheme("vercel-light", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "string", foreground: "166e16" }, // Green for strings
        { token: "number", foreground: "0070f3" }, // Blue for numbers
        { token: "keyword", foreground: "e60067" }, // Pink for keywords
        { token: "comment", foreground: "999999", fontStyle: "italic" },
        { token: "delimiter", foreground: "666666" },
        { token: "delimiter.bracket", foreground: "333333" },
        { token: "key", foreground: "0070f3" }, // Blue for object keys
        { token: "type", foreground: "7928ca" }, // Purple for types
      ],
      colors: {
        "editor.background": "#fafafa", // --background light
        "editor.foreground": "#000000", // --foreground light
        "editor.lineHighlightBackground": "#f4f4f4", // --muted light
        "editor.selectionBackground": "#e0e0e0",
        "editor.selectionHighlightBackground": "#f0f0f0",
        "editorLineNumber.foreground": "#999999", // --muted-foreground light
        "editorLineNumber.activeForeground": "#666666",
        "editor.inactiveSelectionBackground": "#f0f0f0",
        "editorIndentGuide.background": "#e5e5e5", // --border light
        "editorIndentGuide.activeBackground": "#cccccc",
        "scrollbar.shadow": "#00000010",
        "scrollbarSlider.background": "#cccccc80",
        "scrollbarSlider.hoverBackground": "#999999a0",
        "scrollbarSlider.activeBackground": "#666666",
      },
    });

    // Dark theme matching your CSS variables
    monaco.editor.defineTheme("vercel-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "string", foreground: "50e3c2" }, // Cyan for strings
        { token: "number", foreground: "79ffe1" }, // Light cyan for numbers
        { token: "keyword", foreground: "ff0080" }, // Pink for keywords
        { token: "comment", foreground: "888888", fontStyle: "italic" },
        { token: "delimiter", foreground: "cccccc" },
        { token: "delimiter.bracket", foreground: "ffffff" },
        { token: "key", foreground: "79ffe1" }, // Light cyan for object keys
        { token: "type", foreground: "bd93f9" }, // Purple for types
      ],
      colors: {
        "editor.background": "#000000", // --background dark
        "editor.foreground": "#ffffff", // --foreground dark
        "editor.lineHighlightBackground": "#1a1a1a", // --muted dark
        "editor.selectionBackground": "#333333",
        "editor.selectionHighlightBackground": "#2a2a2a",
        "editorLineNumber.foreground": "#666666", // --muted-foreground dark
        "editorLineNumber.activeForeground": "#999999",
        "editor.inactiveSelectionBackground": "#2a2a2a",
        "editorIndentGuide.background": "#333333", // --border dark
        "editorIndentGuide.activeBackground": "#555555",
        "scrollbar.shadow": "#00000030",
        "scrollbarSlider.background": "#55555580",
        "scrollbarSlider.hoverBackground": "#777777a0",
        "scrollbarSlider.activeBackground": "#999999",
      },
    });
  };

  useEffect(() => {
    const formatJson = async () => {
      setIsFormatting(true);
      try {
        // Use requestIdleCallback for non-blocking formatting
        if ("requestIdleCallback" in window) {
          requestIdleCallback(() => {
            const formatted = formatJsonString(jsonValue, 2);
            setFormattedJson(formatted);
            setIsFormatting(false);
          });
        } else {
          // Fallback for browsers without requestIdleCallback
          setTimeout(() => {
            const formatted = formatJsonString(jsonValue, 2);
            setFormattedJson(formatted);
            setIsFormatting(false);
          }, 0);
        }
      } catch (error) {
        console.error("Error formatting JSON:", error);
        const fallback = JSON.stringify(jsonValue, null, 2);
        setFormattedJson(fallback);
        setIsFormatting(false);
      }
    };

    if (jsonValue) {
      formatJson();
    }
  }, [jsonValue]);

  if (isFormatting) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-muted-foreground">Formatting JSON...</div>
      </div>
    );
  }

  if (!formattedJson) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-muted-foreground">No content to display</div>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", width: "100%" }}>
      <Editor
        height="100%"
        width="100%"
        defaultLanguage="json"
        value={formattedJson}
        theme={isDarkMode ? "vercel-dark" : "vercel-light"}
        beforeMount={setupCustomThemes}
        options={{
          readOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: "on",
          lineNumbers: "on",
          folding: true,
          fontSize: 14,
          fontFamily:
            "var(--font-mono), ui-monospace, SFMono-Regular, monospace",
          automaticLayout: true,
          scrollbar: {
            vertical: "auto",
            horizontal: "auto",
            useShadows: false,
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
          renderLineHighlight: "none",
          contextmenu: true,
          selectOnLineNumbers: true,
          glyphMargin: false,
          lineDecorationsWidth: 0,
          lineNumbersMinChars: 3,
        }}
        loading={
          <div className="flex items-center justify-center h-32">
            <div className="text-muted-foreground">Loading editor...</div>
          </div>
        }
      />
    </div>
  );
}
