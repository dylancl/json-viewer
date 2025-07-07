import {
  JsonValue,
  JsonNode,
  JsonNodeType,
  JsonStats,
  SearchResult,
} from "@/types/json";
import {
  isValidJSONPath,
  executeJSONPath,
  convertJSONPathToSearchResults,
} from "@/lib/jsonpath-utils";

export function getJsonNodeType(value: JsonValue): JsonNodeType {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  return typeof value as JsonNodeType;
}

export function createJsonNode(
  value: JsonValue,
  key?: string,
  path: string[] = [],
  depth: number = 0,
  parent?: JsonNode,
  index?: number
): JsonNode {
  const type = getJsonNodeType(value);
  const node: JsonNode = {
    key,
    value,
    type,
    path: key ? [...path, key] : path,
    depth,
    parent,
    index,
    isExpanded: depth < 2, // Auto-expand first 2 levels
  };

  if (type === "object" && value && typeof value === "object") {
    node.children = Object.entries(value).map(([childKey, childValue], idx) =>
      createJsonNode(childValue, childKey, node.path, depth + 1, node, idx)
    );
  } else if (type === "array" && Array.isArray(value)) {
    node.children = value.map((childValue, idx) =>
      createJsonNode(
        childValue,
        idx.toString(),
        node.path,
        depth + 1,
        node,
        idx
      )
    );
  }

  return node;
}

export function createJsonNodeAsync(
  value: JsonValue,
  key?: string,
  path: string[] = [],
  depth: number = 0,
  parent?: JsonNode,
  index?: number,
  onProgress?: (progress: number, status: string) => void
): Promise<JsonNode> {
  return new Promise((resolve) => {
    const type = getJsonNodeType(value);
    const node: JsonNode = {
      key,
      value,
      type,
      path: key ? [...path, key] : path,
      depth,
      parent,
      index,
      isExpanded: depth < 2, // Auto-expand first 2 levels
    };

    if (type === "object" && value && typeof value === "object") {
      const entries = Object.entries(value);
      const children: JsonNode[] = [];
      let processed = 0;

      function processChunk() {
        const chunkSize = 1000;
        const endIndex = Math.min(processed + chunkSize, entries.length);

        for (let i = processed; i < endIndex; i++) {
          const [childKey, childValue] = entries[i];
          children.push(
            createJsonNode(childValue, childKey, node.path, depth + 1, node, i)
          );
        }

        processed = endIndex;
        const progress = Math.round((processed / entries.length) * 100);

        if (onProgress) {
          onProgress(
            progress,
            `Processing object keys: ${processed}/${entries.length}`
          );
        }

        if (processed < entries.length) {
          // Use setTimeout to yield control and prevent blocking
          setTimeout(processChunk, 0);
        } else {
          node.children = children;
          resolve(node);
        }
      }

      if (entries.length > 1000) {
        processChunk();
      } else {
        node.children = entries.map(([childKey, childValue], idx) =>
          createJsonNode(childValue, childKey, node.path, depth + 1, node, idx)
        );
        resolve(node);
      }
    } else if (type === "array" && Array.isArray(value)) {
      const arrayValue = value as JsonValue[];
      const children: JsonNode[] = [];
      let processed = 0;

      function processChunk() {
        const chunkSize = 1000;
        const endIndex = Math.min(processed + chunkSize, arrayValue.length);

        for (let i = processed; i < endIndex; i++) {
          children.push(
            createJsonNode(
              arrayValue[i],
              i.toString(),
              node.path,
              depth + 1,
              node,
              i
            )
          );
        }

        processed = endIndex;
        const progress = Math.round((processed / arrayValue.length) * 100);

        if (onProgress) {
          onProgress(
            progress,
            `Processing array items: ${processed}/${arrayValue.length}`
          );
        }

        if (processed < arrayValue.length) {
          // Use setTimeout to yield control and prevent blocking
          setTimeout(processChunk, 0);
        } else {
          node.children = children;
          resolve(node);
        }
      }

      if (arrayValue.length > 1000) {
        processChunk();
      } else {
        node.children = arrayValue.map((childValue, idx) =>
          createJsonNode(
            childValue,
            idx.toString(),
            node.path,
            depth + 1,
            node,
            idx
          )
        );
        resolve(node);
      }
    } else {
      resolve(node);
    }
  });
}

export function parseJsonSafely(jsonString: string): {
  success: boolean;
  data?: JsonValue;
  error?: string;
} {
  try {
    const data = JSON.parse(jsonString);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown parsing error",
    };
  }
}

export function formatJsonString(value: JsonValue, indent: number = 2): string {
  try {
    return JSON.stringify(value, null, indent);
  } catch {
    return "Error formatting JSON";
  }
}

export function calculateJsonStats(node: JsonNode): JsonStats {
  const stats: JsonStats = {
    totalKeys: 0,
    totalValues: 0,
    depth: 0,
    size: 0,
    objectCount: 0,
    arrayCount: 0,
    stringCount: 0,
    numberCount: 0,
    booleanCount: 0,
    nullCount: 0,
  };

  function traverse(currentNode: JsonNode, currentDepth: number) {
    stats.depth = Math.max(stats.depth, currentDepth);
    stats.totalValues++;

    if (currentNode.key) {
      stats.totalKeys++;
    }

    switch (currentNode.type) {
      case "object":
        stats.objectCount++;
        break;
      case "array":
        stats.arrayCount++;
        break;
      case "string":
        stats.stringCount++;
        stats.size += (currentNode.value as string).length;
        break;
      case "number":
        stats.numberCount++;
        break;
      case "boolean":
        stats.booleanCount++;
        break;
      case "null":
        stats.nullCount++;
        break;
    }

    if (currentNode.children) {
      currentNode.children.forEach((child) =>
        traverse(child, currentDepth + 1)
      );
    }
  }

  traverse(node, 0);
  return stats;
}

export function searchInJson(node: JsonNode, query: string): SearchResult[] {
  const results: SearchResult[] = [];
  const normalizedQuery = query.toLowerCase();

  function traverse(currentNode: JsonNode) {
    // Search in key
    if (
      currentNode.key &&
      currentNode.key.toLowerCase().includes(normalizedQuery)
    ) {
      results.push({
        path: currentNode.path,
        key: currentNode.key,
        value: currentNode.value,
        type: currentNode.type,
        matchType: "key",
      });
    }

    // Search in value (for primitive types)
    if (currentNode.type !== "object" && currentNode.type !== "array") {
      const valueString = String(currentNode.value).toLowerCase();
      if (valueString.includes(normalizedQuery)) {
        results.push({
          path: currentNode.path,
          key: currentNode.key,
          value: currentNode.value,
          type: currentNode.type,
          matchType: "value",
        });
      }
    }

    if (currentNode.children) {
      currentNode.children.forEach(traverse);
    }
  }

  traverse(node);
  return results;
}

export async function searchInJsonAsync(
  node: JsonNode,
  query: string,
  onProgress?: (progress: number, status: string) => void,
  maxResults: number = 1000
): Promise<SearchResult[]> {
  const trimmedQuery = query.trim();

  // Check if the query is a JSONPath expression with better validation
  if (trimmedQuery.startsWith("$") && isValidJSONPath(trimmedQuery)) {
    try {
      return await searchWithJSONPath(
        node,
        trimmedQuery,
        onProgress,
        maxResults
      );
    } catch (error) {
      console.error("JSONPath search failed:", error);
      // Fall back to empty results if JSONPath fails
      return [];
    }
  }

  // Regular text search
  return new Promise((resolve) => {
    const results: SearchResult[] = [];
    const normalizedQuery = trimmedQuery.toLowerCase();
    let processedNodes = 0;
    let totalNodes = 0;
    let lastProgressReport = 0;

    // First pass: count total nodes for progress reporting
    function countNodes(currentNode: JsonNode): number {
      let count = 1;
      if (currentNode.children) {
        count += currentNode.children.reduce(
          (sum, child) => sum + countNodes(child),
          0
        );
      }
      return count;
    }

    totalNodes = countNodes(node);

    const nodesToProcess: JsonNode[] = [node];

    function processChunk() {
      const chunkSize = 500; // Process 500 nodes at a time
      const endIndex = Math.min(chunkSize, nodesToProcess.length);

      for (let i = 0; i < endIndex && results.length < maxResults; i++) {
        const currentNode = nodesToProcess.shift()!;
        processedNodes++;

        // Search in key
        if (
          currentNode.key &&
          currentNode.key.toLowerCase().includes(normalizedQuery)
        ) {
          results.push({
            path: currentNode.path,
            key: currentNode.key,
            value: currentNode.value,
            type: currentNode.type,
            matchType: "key",
          });
        }

        // Search in value (for primitive types)
        if (currentNode.type !== "object" && currentNode.type !== "array") {
          const valueString = String(currentNode.value).toLowerCase();
          if (valueString.includes(normalizedQuery)) {
            results.push({
              path: currentNode.path,
              key: currentNode.key,
              value: currentNode.value,
              type: currentNode.type,
              matchType: "value",
            });
          }
        }

        // Add children to processing queue
        if (currentNode.children) {
          nodesToProcess.push(...currentNode.children);
        }
      }

      // Report progress - throttle to every 5% or significant milestones
      if (onProgress && totalNodes > 0) {
        const progress = Math.min(
          100,
          Math.round((processedNodes / totalNodes) * 100)
        );

        // Only report progress if it's a significant change (5% increment, first result, or completion)
        if (
          progress >= lastProgressReport + 5 ||
          progress === 100 ||
          (results.length === 1 && lastProgressReport === 0) ||
          processedNodes === 1
        ) {
          onProgress(progress, `Searching... ${results.length} matches found`);
          lastProgressReport = progress;
        }
      }

      if (nodesToProcess.length > 0 && results.length < maxResults) {
        // Continue processing in next tick
        setTimeout(processChunk, 0);
      } else {
        // Search complete
        if (onProgress) {
          onProgress(100, `Search complete - ${results.length} matches found`);
        }
        resolve(results);
      }
    }

    // Start processing
    processChunk();
  });
}

export function getValueAtPath(
  node: JsonNode,
  path: string[]
): JsonNode | null {
  let current = node;

  for (const segment of path) {
    if (!current.children) return null;

    const child = current.children.find((c) => c.key === segment);
    if (!child) return null;

    current = child;
  }

  return current;
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export function downloadAsFile(
  content: string,
  filename: string,
  mimeType: string = "application/json"
) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function searchWithJSONPath(
  node: JsonNode,
  jsonPathQuery: string,
  onProgress?: (progress: number, status: string) => void,
  maxResults: number = 1000
): Promise<SearchResult[]> {
  return new Promise((resolve, reject) => {
    try {
      if (onProgress) {
        onProgress(10, "Validating JSONPath expression...");
      }

      if (!isValidJSONPath(jsonPathQuery)) {
        throw new Error("Invalid JSONPath expression");
      }

      if (onProgress) {
        onProgress(30, "Executing JSONPath query...");
      }

      // Get the original JSON data from the node
      const jsonData = reconstructJsonFromNode(node);

      if (onProgress) {
        onProgress(60, "Processing JSONPath results...");
      }

      // Execute JSONPath query
      const jsonPathResults = executeJSONPath(jsonData, jsonPathQuery, {
        maxResults,
        includeParentInfo: true,
      });

      if (onProgress) {
        onProgress(80, "Converting results to search format...");
      }

      // Convert to SearchResult format
      const searchResults = convertJSONPathToSearchResults(
        jsonPathResults,
        jsonPathQuery,
        node
      );

      if (onProgress) {
        onProgress(
          100,
          `JSONPath query complete - ${searchResults.length} matches found`
        );
      }

      resolve(searchResults);
    } catch (error) {
      if (onProgress) {
        onProgress(
          100,
          `JSONPath query failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
      reject(error);
    }
  });
}

export function reconstructJsonFromNode(node: JsonNode): JsonValue {
  if (node.type === "object" && node.children) {
    const obj: { [key: string]: JsonValue } = {};
    node.children.forEach((child) => {
      if (child.key !== undefined) {
        obj[child.key] = reconstructJsonFromNode(child);
      }
    });
    return obj;
  } else if (node.type === "array" && node.children) {
    return node.children.map((child) => reconstructJsonFromNode(child));
  } else {
    return node.value;
  }
}

export function flattenJsonNode(node: JsonNode): JsonNode[] {
  const flattened: JsonNode[] = [];

  function traverse(currentNode: JsonNode) {
    flattened.push(currentNode);

    if (currentNode.isExpanded && currentNode.children) {
      currentNode.children.forEach(traverse);
    }
  }

  traverse(node);
  return flattened;
}
