import {
  parseJsonSafely,
  calculateJsonStats,
  searchWithJSONPath,
} from "@/lib/json-utils";
import {
  JsonNode,
  SearchResult,
  JsonStats,
  JsonValue,
  JsonNodeType,
} from "@/types/json";
import { isValidJSONPath } from "@/lib/jsonpath-utils";

/**
 * Lightweight node metadata for efficient serialization
 */
export interface NodeMetadata {
  key?: string;
  type: string;
  path: string[];
  depth: number;
  hasChildren: boolean;
  childrenCount?: number;
  isExpanded?: boolean;
  valuePreview?: string; // For primitive values
}

export type WorkerMessage =
  | { type: "PARSE_JSON"; payload: { jsonString: string } }
  | {
      type: "PARSE_JSON_METADATA";
      payload: { jsonString: string; maxDepth?: number };
    }
  | { type: "SEARCH"; payload: { node: JsonNode; query: string } }
  | { type: "SEARCH_STREAM"; payload: { node: JsonNode; query: string } }
  | { type: "SEARCH_RAW_JSON"; payload: { jsonString: string; query: string } }
  | {
      type: "SEARCH_RAW_JSON_STREAM";
      payload: { jsonString: string; query: string };
    }
  | { type: "CALCULATE_STATS"; payload: { node: JsonNode } }
  | { type: "EXPAND_NODE"; payload: { node: JsonNode; path: string[] } }
  | {
      type: "LAZY_LOAD_CHILDREN";
      payload: { dataId: string; path: string[]; limit?: number };
    };

export type WorkerResponse =
  | { type: "PARSE_JSON_SUCCESS"; payload: { node: JsonNode } }
  | {
      type: "PARSE_JSON_METADATA_SUCCESS";
      payload: { metadata: NodeMetadata; dataId: string };
    }
  | { type: "PARSE_JSON_ERROR"; payload: { error: string } }
  | { type: "SEARCH_RESULTS"; payload: { results: SearchResult[] } }
  | {
      type: "SEARCH_RESULT_STREAM";
      payload: { result?: SearchResult; isComplete: boolean };
    }
  | { type: "STATS_CALCULATED"; payload: { stats: JsonStats } }
  | { type: "NODE_EXPANDED"; payload: { node: JsonNode } }
  | { type: "CHILDREN_LOADED"; payload: { children: JsonNode[] } }
  | { type: "PROGRESS"; payload: { progress: number; status: string } };

// Store parsed data for lazy loading to avoid memory duplication
const workerDataStore = new Map<string, JsonNode>();

// Cleanup old data periodically to prevent memory leaks
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const DATA_EXPIRY = 30 * 60 * 1000; // 30 minutes
const dataTimestamps = new Map<string, number>();

setInterval(() => {
  const now = Date.now();
  for (const [dataId, timestamp] of dataTimestamps.entries()) {
    if (now - timestamp > DATA_EXPIRY) {
      workerDataStore.delete(dataId);
      dataTimestamps.delete(dataId);
    }
  }
}, CLEANUP_INTERVAL);

self.onmessage = function (e) {
  const { type, payload, messageId } = e.data;

  try {
    switch (type) {
      case "PARSE_JSON":
        handleParseJson(payload.jsonString, messageId);
        break;
      case "PARSE_JSON_METADATA":
        handleParseJsonMetadata(
          payload.jsonString,
          messageId,
          payload.maxDepth
        );
        break;
      case "SEARCH":
        handleSearch(payload.node, payload.query, messageId);
        break;
      case "SEARCH_STREAM":
        handleSearchStream(payload.node, payload.query, messageId);
        break;
      case "SEARCH_RAW_JSON":
        handleSearchRawJson(payload.jsonString, payload.query, messageId);
        break;
      case "SEARCH_RAW_JSON_STREAM":
        handleSearchRawJsonStream(payload.jsonString, payload.query, messageId);
        break;
      case "CALCULATE_STATS":
        handleCalculateStats(payload.node, messageId);
        break;
      case "LAZY_LOAD_CHILDREN":
        handleLazyLoadChildren(
          payload.dataId,
          payload.path,
          messageId,
          payload.limit
        );
        break;
      default:
        console.warn("Unknown message type:", type);
    }
  } catch (error) {
    self.postMessage({
      type: "ERROR",
      payload: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      messageId,
    });
  }
};

/**
 * Memory-efficient metadata parsing for large datasets
 * Avoids creating full JsonNode trees for very large objects
 */
function handleParseJsonMetadata(
  jsonString: string,
  messageId: number,
  maxDepth = 2
) {
  self.postMessage({
    type: "PROGRESS",
    payload: { progress: 10, status: "Parsing JSON for metadata..." },
    messageId,
  });

  const parseResult = parseJsonSafely(jsonString);

  if (!parseResult.success || parseResult.data === undefined) {
    self.postMessage({
      type: "PARSE_JSON_ERROR",
      payload: { error: parseResult.error || "Failed to parse JSON" },
      messageId,
    });
    return;
  }

  self.postMessage({
    type: "PROGRESS",
    payload: { progress: 30, status: "Creating metadata..." },
    messageId,
  });

  try {
    // Create a shallow node tree for metadata extraction
    const node = createJsonNodeWithProgress(parseResult.data, messageId);

    // Store the full node for later lazy loading
    const dataId = `data_${messageId}_${Date.now()}`;
    workerDataStore.set(dataId, node);
    dataTimestamps.set(dataId, Date.now());

    // Extract metadata from root node
    const metadata = extractNodeMetadata(node, maxDepth);

    self.postMessage({
      type: "PROGRESS",
      payload: { progress: 100, status: "Complete" },
      messageId,
    });

    self.postMessage({
      type: "PARSE_JSON_METADATA_SUCCESS",
      payload: { metadata, dataId },
      messageId,
    });
  } catch (error) {
    self.postMessage({
      type: "PARSE_JSON_ERROR",
      payload: {
        error:
          error instanceof Error ? error.message : "Failed to create metadata",
      },
      messageId,
    });
  }
}

/**
 * Extract minimal metadata from JsonNode to avoid serialization overhead
 */
function extractNodeMetadata(node: JsonNode, maxDepth: number): NodeMetadata {
  return {
    key: node.key,
    type: node.type,
    path: node.path,
    depth: node.depth,
    hasChildren: !!(node.children && node.children.length > 0),
    childrenCount: node.children?.length,
    isExpanded: node.depth < maxDepth,
    valuePreview:
      node.type !== "object" && node.type !== "array"
        ? String(node.value).substring(0, 100)
        : undefined,
  };
}

/**
 * Lazy loading for child nodes to avoid memory overhead
 */
function handleLazyLoadChildren(
  dataId: string,
  path: string[],
  messageId: number,
  limit = 100
) {
  const rootNode = workerDataStore.get(dataId);
  if (!rootNode) {
    self.postMessage({
      type: "CHILDREN_LOADED",
      payload: { children: [] },
      messageId,
    });
    return;
  }

  // Navigate to the target node using the path
  let currentNode = rootNode;
  for (const pathSegment of path) {
    const child = currentNode.children?.find(
      (child) => child.key === pathSegment
    );
    if (!child) {
      self.postMessage({
        type: "CHILDREN_LOADED",
        payload: { children: [] },
        messageId,
      });
      return;
    }
    currentNode = child;
  }

  // Return children up to the limit
  const children = currentNode.children?.slice(0, limit) || [];

  self.postMessage({
    type: "CHILDREN_LOADED",
    payload: { children },
    messageId,
  });
}

function handleParseJson(jsonString: string, messageId: number) {
  self.postMessage({
    type: "PROGRESS",
    payload: { progress: 10, status: "Parsing JSON..." },
    messageId,
  });

  const parseResult = parseJsonSafely(jsonString);

  if (!parseResult.success || parseResult.data === undefined) {
    self.postMessage({
      type: "PARSE_JSON_ERROR",
      payload: { error: parseResult.error || "Failed to parse JSON" },
      messageId,
    });
    return;
  }

  self.postMessage({
    type: "PROGRESS",
    payload: { progress: 30, status: "Creating node tree..." },
    messageId,
  });

  try {
    // Create node tree with progress reporting
    const node = createJsonNodeWithProgress(parseResult.data, messageId);

    self.postMessage({
      type: "PROGRESS",
      payload: { progress: 100, status: "Complete" },
      messageId,
    });

    self.postMessage({
      type: "PARSE_JSON_SUCCESS",
      payload: { node },
      messageId,
    });
  } catch (error) {
    self.postMessage({
      type: "PARSE_JSON_ERROR",
      payload: {
        error:
          error instanceof Error ? error.message : "Failed to create node tree",
      },
      messageId,
    });
  }
}

function createJsonNodeWithProgress(
  value: JsonValue,
  messageId: number,
  key?: string,
  path: string[] = [],
  depth: number = 0,
  parent?: JsonNode,
  index?: number
): JsonNode {
  const getJsonNodeType = (val: JsonValue): JsonNodeType => {
    if (val === null) return "null";
    if (Array.isArray(val)) return "array";
    if (typeof val === "object") return "object";
    return typeof val as JsonNodeType;
  };

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

    for (let i = 0; i < entries.length; i++) {
      const [childKey, childValue] = entries[i];
      children.push(
        createJsonNodeWithProgress(
          childValue,
          messageId,
          childKey,
          node.path,
          depth + 1,
          node,
          i
        )
      );

      // Report progress for large objects
      if (entries.length > 1000 && i % 500 === 0) {
        const progress = 30 + Math.round((i / entries.length) * 60);
        self.postMessage({
          type: "PROGRESS",
          payload: {
            progress,
            status: `Processing object keys: ${i + 1}/${entries.length}`,
          },
          messageId,
        });
      }
    }
    node.children = children;
  } else if (type === "array" && Array.isArray(value)) {
    const children: JsonNode[] = [];

    for (let i = 0; i < value.length; i++) {
      children.push(
        createJsonNodeWithProgress(
          value[i],
          messageId,
          i.toString(),
          node.path,
          depth + 1,
          node,
          i
        )
      );

      // Report progress for large arrays
      if (value.length > 1000 && i % 500 === 0) {
        const progress = 30 + Math.round((i / value.length) * 60);
        self.postMessage({
          type: "PROGRESS",
          payload: {
            progress,
            status: `Processing array items: ${i + 1}/${value.length}`,
          },
          messageId,
        });
      }
    }
    node.children = children;
  }

  return node;
}

function handleSearch(node: JsonNode, query: string, messageId: number) {
  // Check if the query is a JSONPath expression
  if (isValidJSONPath(query)) {
    // Handle JSONPath search
    self.postMessage({
      type: "PROGRESS",
      payload: { progress: 10, status: "Processing JSONPath query..." },
      messageId,
    });

    searchWithJSONPath(node, query, (progress, status) => {
      self.postMessage({
        type: "PROGRESS",
        payload: { progress, status },
        messageId,
      });
    })
      .then((results) => {
        self.postMessage({
          type: "SEARCH_RESULTS",
          payload: { results },
          messageId,
        });
      })
      .catch((error) => {
        // Fallback to regular search if JSONPath fails
        console.warn(
          "JSONPath search failed, falling back to regular search:",
          error
        );
        handleRegularSearch(node, query, messageId);
      });
    return;
  }

  // Regular text search
  handleRegularSearch(node, query, messageId);
}

function handleRegularSearch(node: JsonNode, query: string, messageId: number) {
  const results: SearchResult[] = [];
  const normalizedQuery = query.toLowerCase();
  let processedNodes = 0;
  let totalNodes = 0;
  const maxResults = 1000;

  // Early exit for empty queries
  if (!query.trim()) {
    self.postMessage({
      type: "SEARCH_RESULTS",
      payload: { results: [] },
      messageId,
    });
    return;
  }

  // First pass: count total nodes for progress reporting (with early termination)
  function countNodes(currentNode: JsonNode, maxCount: number = 50000): number {
    let count = 1;
    if (count >= maxCount) return maxCount; // Early termination for very large datasets

    if (currentNode.children) {
      for (const child of currentNode.children) {
        count += countNodes(child, maxCount - count);
        if (count >= maxCount) break;
      }
    }
    return Math.min(count, maxCount);
  }

  totalNodes = countNodes(node);

  // Use BFS instead of DFS for better early result discovery
  const nodesToProcess: JsonNode[] = [node];
  const processedPaths = new Set<string>(); // Prevent duplicate processing

  function processChunk() {
    const chunkSize = 2000; // Increased chunk size for better performance
    const endIndex = Math.min(chunkSize, nodesToProcess.length);

    for (let i = 0; i < endIndex && results.length < maxResults; i++) {
      const currentNode = nodesToProcess.shift()!;
      const pathKey = currentNode.path.join(".");

      // Skip if already processed (prevents infinite loops)
      if (processedPaths.has(pathKey)) continue;
      processedPaths.add(pathKey);

      processedNodes++;

      // Optimized key search with early termination
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

        // Early exit if we have enough results
        if (results.length >= maxResults) break;
      }

      // Optimized value search for primitive types only
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

          // Early exit if we have enough results
          if (results.length >= maxResults) break;
        }
      }

      // Add children to processing queue (BFS)
      if (currentNode.children) {
        nodesToProcess.push(...currentNode.children);
      }
    }

    // Report progress every 2000 nodes processed (less frequent for better performance)
    if (
      processedNodes % 2000 === 0 ||
      nodesToProcess.length === 0 ||
      results.length >= maxResults
    ) {
      const progress =
        totalNodes > 0
          ? Math.min(100, Math.round((processedNodes / totalNodes) * 100))
          : 100;
      self.postMessage({
        type: "PROGRESS",
        payload: {
          progress,
          status: `Searching... ${results.length} matches found`,
        },
        messageId,
      });
    }

    if (nodesToProcess.length > 0 && results.length < maxResults) {
      // Continue processing in next tick with shorter delay
      setTimeout(processChunk, 1);
    } else {
      // Search complete
      self.postMessage({
        type: "SEARCH_RESULTS",
        payload: { results },
        messageId,
      });
    }
  }

  // Start processing
  processChunk();
}

function handleSearchStream(node: JsonNode, query: string, messageId: number) {
  // Check if the query is a JSONPath expression
  if (isValidJSONPath(query)) {
    // Handle JSONPath search with streaming
    self.postMessage({
      type: "PROGRESS",
      payload: { progress: 10, status: "Processing JSONPath query..." },
      messageId,
    });

    searchWithJSONPath(node, query, (progress, status) => {
      self.postMessage({
        type: "PROGRESS",
        payload: { progress, status },
        messageId,
      });
    })
      .then((results) => {
        // Stream JSONPath results one by one
        results.forEach((result, index) => {
          self.postMessage({
            type: "SEARCH_RESULT_STREAM",
            payload: {
              result,
              isComplete: index === results.length - 1,
            },
            messageId,
          });
        });

        if (results.length === 0) {
          self.postMessage({
            type: "SEARCH_RESULT_STREAM",
            payload: {
              isComplete: true,
            },
            messageId,
          });
        }
      })
      .catch((error) => {
        // Fallback to regular streaming search if JSONPath fails
        console.warn(
          "JSONPath search failed, falling back to regular search:",
          error
        );
        handleRegularSearchStream(node, query, messageId);
      });
    return;
  }

  // Regular text search with streaming
  handleRegularSearchStream(node, query, messageId);
}

function handleRegularSearchStream(
  node: JsonNode,
  query: string,
  messageId: number
) {
  const normalizedQuery = query.toLowerCase();
  let processedNodes = 0;
  let totalNodes = 0;
  let foundResults = 0;
  const maxResults = 1000;
  const streamBatchSize = 5; // Stream results in batches of 5
  let resultBatch: SearchResult[] = [];

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

  function streamBatch() {
    if (resultBatch.length > 0) {
      resultBatch.forEach((result) => {
        self.postMessage({
          type: "SEARCH_RESULT_STREAM",
          payload: {
            result,
            isComplete: false,
          },
          messageId,
        });
      });
      resultBatch = [];
    }
  }

  function processChunk() {
    const chunkSize = 100; // Smaller chunks for more responsive streaming
    const endIndex = Math.min(chunkSize, nodesToProcess.length);

    for (let i = 0; i < endIndex && foundResults < maxResults; i++) {
      const currentNode = nodesToProcess.shift()!;
      processedNodes++;

      // Search in key
      if (
        currentNode.key &&
        currentNode.key.toLowerCase().includes(normalizedQuery)
      ) {
        const result: SearchResult = {
          path: currentNode.path,
          key: currentNode.key,
          value: currentNode.value,
          type: currentNode.type,
          matchType: "key",
        };

        resultBatch.push(result);
        foundResults++;

        // Stream batch when it reaches the batch size
        if (resultBatch.length >= streamBatchSize) {
          streamBatch();
        }
      }

      // Search in value (for primitive types)
      if (currentNode.type !== "object" && currentNode.type !== "array") {
        const valueString = String(currentNode.value).toLowerCase();
        if (valueString.includes(normalizedQuery)) {
          const result: SearchResult = {
            path: currentNode.path,
            key: currentNode.key,
            value: currentNode.value,
            type: currentNode.type,
            matchType: "value",
          };

          resultBatch.push(result);
          foundResults++;

          // Stream batch when it reaches the batch size
          if (resultBatch.length >= streamBatchSize) {
            streamBatch();
          }
        }
      }

      // Add children to processing queue
      if (currentNode.children) {
        nodesToProcess.push(...currentNode.children);
      }
    }

    // Report progress every 1000 nodes processed (more frequent for streaming)
    if (processedNodes % 1000 === 0 || nodesToProcess.length === 0) {
      const progress =
        totalNodes > 0
          ? Math.min(100, Math.round((processedNodes / totalNodes) * 100))
          : 100;
      self.postMessage({
        type: "PROGRESS",
        payload: {
          progress,
          status: `Searching... ${foundResults} matches found`,
        },
        messageId,
      });
    }

    if (nodesToProcess.length > 0 && foundResults < maxResults) {
      // Continue processing in next tick (more frequent for streaming)
      setTimeout(processChunk, 1);
    } else {
      // Stream any remaining results in the batch
      streamBatch();

      // Search complete - send completion signal
      self.postMessage({
        type: "SEARCH_RESULT_STREAM",
        payload: {
          isComplete: true,
        },
        messageId,
      });
    }
  }

  // Start processing
  processChunk();
}

function handleCalculateStats(node: JsonNode, messageId: number) {
  const stats = calculateJsonStats(node);
  self.postMessage({
    type: "STATS_CALCULATED",
    payload: { stats },
    messageId,
  });
}

function handleSearchRawJson(
  jsonString: string,
  query: string,
  messageId: number
) {
  self.postMessage({
    type: "PROGRESS",
    payload: { progress: 5, status: "Parsing JSON..." },
    messageId,
  });

  const parseResult = parseJsonSafely(jsonString);

  if (!parseResult.success || parseResult.data === undefined) {
    self.postMessage({
      type: "SEARCH_RESULTS",
      payload: { results: [] },
      messageId,
    });
    return;
  }

  self.postMessage({
    type: "PROGRESS",
    payload: { progress: 20, status: "Creating node tree..." },
    messageId,
  });

  try {
    // Create node tree more efficiently for search-only purposes
    const node = createJsonNodeWithProgress(parseResult.data, messageId);

    self.postMessage({
      type: "PROGRESS",
      payload: { progress: 50, status: "Starting search..." },
      messageId,
    });

    // Use the existing search logic
    handleSearch(node, query, messageId);
  } catch {
    self.postMessage({
      type: "SEARCH_RESULTS",
      payload: { results: [] },
      messageId,
    });
  }
}

function handleSearchRawJsonStream(
  jsonString: string,
  query: string,
  messageId: number
) {
  self.postMessage({
    type: "PROGRESS",
    payload: { progress: 5, status: "Parsing JSON..." },
    messageId,
  });

  const parseResult = parseJsonSafely(jsonString);

  if (!parseResult.success || parseResult.data === undefined) {
    self.postMessage({
      type: "SEARCH_RESULT_STREAM",
      payload: { isComplete: true },
      messageId,
    });
    return;
  }

  self.postMessage({
    type: "PROGRESS",
    payload: { progress: 20, status: "Creating node tree..." },
    messageId,
  });

  try {
    // Create node tree more efficiently for search-only purposes
    const node = createJsonNodeWithProgress(parseResult.data, messageId);

    self.postMessage({
      type: "PROGRESS",
      payload: { progress: 50, status: "Starting search..." },
      messageId,
    });

    // Use the existing streaming search logic
    handleSearchStream(node, query, messageId);
  } catch {
    self.postMessage({
      type: "SEARCH_RESULT_STREAM",
      payload: { isComplete: true },
      messageId,
    });
  }
}
