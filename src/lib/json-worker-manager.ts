import { WorkerMessage, WorkerResponse, NodeMetadata } from "@/lib/json-worker";
import { JsonNode, JsonStats, SearchResult, JsonNodeType } from "@/types/json";

/**
 * LRU Cache for parsed JSON results to optimize memory usage
 *
 * @example
 * ```typescript
 * const cache = new LRUCache<JsonNode>(10, 300000); // 10 items, 5 min TTL
 * cache.set('key', jsonNode);
 * const cached = cache.get('key'); // Returns JsonNode or null if expired/not found
 * ```
 */
class LRUCache<T> {
  private cache = new Map<string, { value: T; timestamp: number }>();
  private readonly maxSize: number;
  private readonly maxAge: number; // in milliseconds

  constructor(maxSize = 10, maxAge = 300000) {
    // 5 minutes default
    this.maxSize = maxSize;
    this.maxAge = maxAge;
  }

  get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    // Check if expired
    if (Date.now() - item.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, { ...item, timestamp: Date.now() });
    return item.value;
  }

  set(key: string, value: T): void {
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, { value, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  getMemoryUsage(): number {
    return this.cache.size * 1024; // Rough estimate in bytes
  }
}

/**
 * Operation tracking for memory management
 */
interface OperationMetadata {
  messageId: number;
  startTime: number;
  type: string;
  memoryEstimate: number; // Estimated memory usage in bytes
}

/**
 * Dynamic Worker Pool for optimal resource allocation
 */
class WorkerPool {
  private workers: Worker[] = [];
  private availableWorkers: Worker[] = [];
  private readonly MAX_WORKERS = Math.min(
    navigator.hardwareConcurrency || 4,
    8
  );
  private workerUsage = new Map<Worker, number>(); // Track usage count per worker

  getOptimalWorkerCount(dataSize: number): number {
    if (dataSize > 50_000_000) return this.MAX_WORKERS;
    if (dataSize > 10_000_000) return Math.min(2, this.MAX_WORKERS);
    return 1;
  }

  async getWorker(dataSize: number): Promise<Worker> {
    const optimalCount = this.getOptimalWorkerCount(dataSize);

    // Try to get an available worker first
    if (this.availableWorkers.length > 0) {
      const worker = this.availableWorkers.pop()!;
      this.workerUsage.set(worker, (this.workerUsage.get(worker) || 0) + 1);
      return worker;
    }

    // Create new worker if we haven't reached the optimal count
    if (this.workers.length < optimalCount) {
      const worker = new Worker(new URL("./json-worker.ts", import.meta.url));
      this.workers.push(worker);
      this.workerUsage.set(worker, 1);
      return worker;
    }

    // Find the least used worker
    let leastUsedWorker = this.workers[0];
    let minUsage = this.workerUsage.get(leastUsedWorker) || 0;

    for (const worker of this.workers) {
      const usage = this.workerUsage.get(worker) || 0;
      if (usage < minUsage) {
        minUsage = usage;
        leastUsedWorker = worker;
      }
    }

    this.workerUsage.set(leastUsedWorker, minUsage + 1);
    return leastUsedWorker;
  }

  releaseWorker(worker: Worker): void {
    const currentUsage = this.workerUsage.get(worker) || 0;
    if (currentUsage > 0) {
      this.workerUsage.set(worker, currentUsage - 1);
    }

    // Return to available pool if not heavily used
    if (currentUsage <= 1 && !this.availableWorkers.includes(worker)) {
      this.availableWorkers.push(worker);
    }
  }

  terminate(): void {
    this.workers.forEach((worker) => worker.terminate());
    this.workers = [];
    this.availableWorkers = [];
    this.workerUsage.clear();
  }

  getStats(): {
    totalWorkers: number;
    availableWorkers: number;
    maxWorkers: number;
  } {
    return {
      totalWorkers: this.workers.length,
      availableWorkers: this.availableWorkers.length,
      maxWorkers: this.MAX_WORKERS,
    };
  }
}

/**
 * Optimized Web Worker Manager for JSON operations with comprehensive memory management
 *
 * This class provides intelligent memory management for handling very large JSON datasets
 * in web workers, preventing memory leaks and ensuring optimal performance.
 *
 * Performance Strategy:
 * - Small datasets (<5k nodes): Direct synchronous operations
 * - Medium datasets (5k-50k nodes): Main thread async with chunking
 * - Large datasets (>50k nodes): Web Worker with streaming
 * - Very large JSON (>5MB): Raw JSON processing in worker to avoid serialization overhead
 *
 * Key optimizations:
 * - Dynamic worker pool scaling based on data size
 * - Lazy loading with node metadata instead of full serialization
 * - Memory-efficient parsing with worker-resident data
 * - Streaming results for better perceived performance
 * - Proper timeout handling and resource cleanup
 * - Memory management with LRU cache and operation limits
 * - Automatic cleanup of stale operations
 */
export class JsonWorkerManager {
  private workerPool: WorkerPool;
  private messageId = 0;
  private pendingCallbacks = new Map<
    number,
    (response: WorkerResponse) => void
  >();
  private progressCallbacks = new Map<
    number,
    (progress: number, status: string) => void
  >();
  private streamCallbacks = new Map<number, (result: SearchResult) => void>();
  private timeoutIds = new Map<number, NodeJS.Timeout>();
  private rejectCallbacks = new Map<number, (error: Error) => void>();
  private workerMessageMap = new Map<number, Worker>(); // Track which worker handles which message

  // Memory management properties
  private readonly MAX_CONCURRENT_OPERATIONS = 3;
  private readonly MEMORY_CLEANUP_INTERVAL = 30000; // 30 seconds
  private readonly MAX_OPERATION_AGE = 300000; // 5 minutes
  private readonly MAX_MEMORY_USAGE = 100 * 1024 * 1024; // 100MB

  private operationMetadata = new Map<number, OperationMetadata>();
  private metadataCache = new LRUCache<NodeMetadata[]>(10, 300000); // Cache node metadata instead of full nodes
  private parsedDataIds = new Map<string, string>(); // Map cache keys to worker-resident data IDs
  private memoryCleanupInterval: NodeJS.Timeout | null = null;
  private currentMemoryUsage = 0;

  constructor() {
    this.workerPool = new WorkerPool();
    this.startMemoryManagement();
  }

  /**
   * Determine if worker should be used based on data size and complexity
   *
   * @param jsonString - Original JSON string (for size-based decisions)
   * @param stats - JSON statistics (for node count decisions)
   * @param isComplexQuery - Whether the query is complex (e.g., JSONPath)
   * @returns true if worker should be used, false for main thread processing
   */
  static shouldUseWorker(
    jsonString?: string,
    stats?: JsonStats | null,
    isComplexQuery?: boolean
  ): boolean {
    // Use worker for very large JSON strings (>5MB)
    if (jsonString && jsonString.length > 5000000) {
      return true;
    }

    // Use worker for large datasets (>50k nodes)
    if (stats && stats.totalValues > 50000) {
      return true;
    }

    // Use worker for complex JSONPath queries on medium datasets (>10k nodes)
    if (isComplexQuery && stats && stats.totalValues > 10000) {
      return true;
    }

    return false;
  }

  /**
   * Start memory management routines
   */
  private startMemoryManagement(): void {
    if (typeof window === "undefined") return;

    this.memoryCleanupInterval = setInterval(() => {
      this.cleanupMemory();
    }, this.MEMORY_CLEANUP_INTERVAL);
  }

  /**
   * Comprehensive memory cleanup
   */
  private cleanupMemory(): void {
    const now = Date.now();
    const staleOperations: number[] = [];

    // Find stale operations
    for (const [messageId, metadata] of this.operationMetadata.entries()) {
      if (now - metadata.startTime > this.MAX_OPERATION_AGE) {
        staleOperations.push(messageId);
      }
    }

    // Clean up stale operations
    for (const messageId of staleOperations) {
      this.cleanupOperation(messageId, "Operation cleanup due to age");
    }

    // Clean up cache if memory usage is too high
    if (this.currentMemoryUsage > this.MAX_MEMORY_USAGE) {
      this.metadataCache.clear();
      this.parsedDataIds.clear();
      this.currentMemoryUsage = this.calculateCurrentMemoryUsage();
    }

    // Force garbage collection if available (development mode)
    if (
      typeof window !== "undefined" &&
      "gc" in window &&
      typeof (window as unknown as { gc?: () => void }).gc === "function"
    ) {
      try {
        (window as unknown as { gc: () => void }).gc();
      } catch {
        // Ignore errors - gc might not be available
      }
    }
  }

  /**
   * Clean up a specific operation
   */
  private cleanupOperation(messageId: number, reason?: string): void {
    // Clear timeout
    const timeoutId = this.timeoutIds.get(messageId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.timeoutIds.delete(messageId);
    }

    // Reject if callback exists
    const rejectCallback = this.rejectCallbacks.get(messageId);
    if (rejectCallback) {
      rejectCallback(new Error(reason || "Operation cleaned up"));
    }

    // Clean up all maps
    this.pendingCallbacks.delete(messageId);
    this.progressCallbacks.delete(messageId);
    this.streamCallbacks.delete(messageId);
    this.rejectCallbacks.delete(messageId);

    // Update memory tracking
    const metadata = this.operationMetadata.get(messageId);
    if (metadata) {
      this.currentMemoryUsage -= metadata.memoryEstimate;
      this.operationMetadata.delete(messageId);
    }
  }

  /**
   * Calculate current memory usage estimate
   */
  private calculateCurrentMemoryUsage(): number {
    let total = 0;

    // Add callback maps overhead
    total += this.pendingCallbacks.size * 1024; // Rough estimate per callback
    total += this.progressCallbacks.size * 512;
    total += this.streamCallbacks.size * 512;
    total += this.rejectCallbacks.size * 512;

    // Add cache memory (metadata is much smaller than full nodes)
    total += this.metadataCache.getMemoryUsage();

    // Add operation metadata
    total += this.operationMetadata.size * 256;

    // Add parsed data IDs overhead
    total += this.parsedDataIds.size * 128;

    return total;
  }

  /**
   * Check if we can accept a new operation based on memory and concurrency limits
   */
  private canAcceptNewOperation(estimatedMemory: number): boolean {
    // Check concurrent operations limit
    if (this.operationMetadata.size >= this.MAX_CONCURRENT_OPERATIONS) {
      return false;
    }

    // Check memory limit
    if (this.currentMemoryUsage + estimatedMemory > this.MAX_MEMORY_USAGE) {
      return false;
    }

    return true;
  }

  /**
   * Estimate memory usage for an operation
   */
  private estimateOperationMemory(message: WorkerMessage): number {
    let estimate = 1024; // Base overhead

    if (message.type === "PARSE_JSON" && message.payload.jsonString) {
      // Estimate 2x the JSON string size for parsing overhead
      estimate += message.payload.jsonString.length * 2;
    } else if (message.type === "SEARCH" && message.payload.node) {
      // Estimate based on node complexity (rough calculation)
      estimate += 50 * 1024; // 50KB for search operations
    } else if (
      message.type === "SEARCH_RAW_JSON" &&
      message.payload.jsonString
    ) {
      // Raw JSON search - estimate based on string size
      estimate += message.payload.jsonString.length * 0.5;
    }

    return estimate;
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): {
    currentUsage: number;
    maxUsage: number;
    activeOperations: number;
    maxOperations: number;
    cacheSize: number;
    workerPoolStats: {
      totalWorkers: number;
      availableWorkers: number;
      maxWorkers: number;
    };
  } {
    return {
      currentUsage: this.currentMemoryUsage,
      maxUsage: this.MAX_MEMORY_USAGE,
      activeOperations: this.operationMetadata.size,
      maxOperations: this.MAX_CONCURRENT_OPERATIONS,
      cacheSize: this.metadataCache.size(),
      workerPoolStats: this.workerPool.getStats(),
    };
  }

  private setupWorkerMessageHandler(worker: Worker): void {
    worker.onmessage = (e: MessageEvent) => {
      const { messageId, type } = e.data;

      if (
        messageId &&
        type === "PROGRESS" &&
        this.progressCallbacks.has(messageId)
      ) {
        // Reset timeout when progress is received
        const existingTimeoutId = this.timeoutIds.get(messageId);
        if (existingTimeoutId) {
          clearTimeout(existingTimeoutId);
          const rejectCallback = this.rejectCallbacks.get(messageId);
          if (rejectCallback) {
            const newTimeoutId = setTimeout(() => {
              this.cleanupOperation(
                messageId,
                "Worker operation timed out after progress"
              );
            }, 120000); // 2 minute timeout after progress
            this.timeoutIds.set(messageId, newTimeoutId);
          }
        }

        const progressCallback = this.progressCallbacks.get(messageId);
        progressCallback?.(e.data.payload.progress, e.data.payload.status);
      } else if (
        messageId &&
        type === "SEARCH_RESULT_STREAM" &&
        this.streamCallbacks.has(messageId)
      ) {
        // Handle streaming search results
        const { result, isComplete } = e.data.payload;

        if (result) {
          const streamCallback = this.streamCallbacks.get(messageId);
          streamCallback?.(result);
        }

        if (isComplete) {
          // Clean up stream
          const callback = this.pendingCallbacks.get(messageId);
          callback?.({ type: "SEARCH_RESULTS", payload: { results: [] } }); // Empty results since we streamed them
          this.cleanupOperation(messageId);
        }
      } else if (messageId && this.pendingCallbacks.has(messageId)) {
        const callback = this.pendingCallbacks.get(messageId);
        callback?.(e.data);
        this.cleanupOperation(messageId);
      }
    };
  }

  private async postMessage(
    message: WorkerMessage,
    onProgress?: (progress: number, status: string) => void,
    onStreamResult?: (result: SearchResult) => void
  ): Promise<WorkerResponse> {
    return new Promise(async (resolve, reject) => {
      // Estimate memory usage for this operation
      const estimatedMemory = this.estimateOperationMemory(message);

      // Check if we can accept this operation
      if (!this.canAcceptNewOperation(estimatedMemory)) {
        reject(
          new Error(
            `Cannot accept operation: ${
              this.operationMetadata.size >= this.MAX_CONCURRENT_OPERATIONS
                ? "Too many concurrent operations"
                : "Memory limit would be exceeded"
            }`
          )
        );
        return;
      }

      // Get appropriate worker from pool
      const jsonString =
        message.type === "PARSE_JSON"
          ? message.payload.jsonString
          : message.type === "SEARCH_RAW_JSON"
          ? message.payload.jsonString
          : message.type === "SEARCH_RAW_JSON_STREAM"
          ? message.payload.jsonString
          : "";

      const dataSize = jsonString.length;
      const worker = await this.workerPool.getWorker(dataSize);

      // Setup message handler if not already done
      if (!worker.onmessage) {
        this.setupWorkerMessageHandler(worker);
      }

      const messageId = ++this.messageId;
      const timeoutId = setTimeout(() => {
        this.cleanupOperation(messageId, "Worker operation timed out");
      }, 120000); // 2 minute initial timeout

      // Track operation metadata
      this.operationMetadata.set(messageId, {
        messageId,
        startTime: Date.now(),
        type: message.type,
        memoryEstimate: estimatedMemory,
      });

      // Track which worker is handling this message
      this.workerMessageMap.set(messageId, worker);

      // Update current memory usage
      this.currentMemoryUsage += estimatedMemory;

      this.pendingCallbacks.set(messageId, (response) => {
        // Release worker back to pool
        this.workerPool.releaseWorker(worker);
        this.workerMessageMap.delete(messageId);
        // Clean up operation on completion
        this.cleanupOperation(messageId);
        resolve(response);
      });

      this.rejectCallbacks.set(messageId, (error) => {
        // Release worker back to pool
        this.workerPool.releaseWorker(worker);
        this.workerMessageMap.delete(messageId);
        // Clean up operation on error
        this.cleanupOperation(messageId);
        reject(error);
      });

      this.timeoutIds.set(messageId, timeoutId);

      if (onProgress) {
        this.progressCallbacks.set(messageId, onProgress);
      }

      if (onStreamResult) {
        this.streamCallbacks.set(messageId, onStreamResult);
      }

      worker.postMessage({
        ...message,
        messageId,
      });
    });
  }

  async parseJson(
    jsonString: string,
    onProgress?: (progress: number, status: string) => void
  ): Promise<JsonNode> {
    // Use metadata approach for very large datasets to avoid memory doubling
    if (jsonString.length > 10_000_000) {
      return this.parseJsonWithMetadata(jsonString, onProgress);
    }

    // Check metadata cache first for smaller datasets
    const cacheKey = `parse_${jsonString.substring(0, 100)}_${
      jsonString.length
    }`;
    const cachedMetadata = this.metadataCache.get(cacheKey);
    if (cachedMetadata) {
      return this.reconstructNodeFromMetadata(cachedMetadata[0]);
    }

    const response = await this.postMessage(
      {
        type: "PARSE_JSON",
        payload: { jsonString },
      },
      onProgress
    );

    if (response.type === "PARSE_JSON_ERROR") {
      throw new Error(response.payload.error);
    }

    if (response.type === "PARSE_JSON_SUCCESS") {
      const result = response.payload.node;

      // Cache metadata for future use
      const metadata = this.extractNodeMetadata(result);
      this.metadataCache.set(cacheKey, [metadata]);

      return result;
    }

    throw new Error("Unexpected response type");
  }

  /**
   * Memory-efficient parsing using metadata for very large datasets
   */
  async parseJsonWithMetadata(
    jsonString: string,
    onProgress?: (progress: number, status: string) => void
  ): Promise<JsonNode> {
    const response = await this.postMessage(
      {
        type: "PARSE_JSON_METADATA",
        payload: { jsonString, maxDepth: 3 },
      },
      onProgress
    );

    if (response.type === "PARSE_JSON_ERROR") {
      throw new Error(response.payload.error);
    }

    if (response.type === "PARSE_JSON_METADATA_SUCCESS") {
      const { metadata, dataId } = response.payload;

      // Store the data ID for lazy loading
      const cacheKey = `parse_${jsonString.substring(0, 100)}_${
        jsonString.length
      }`;
      this.parsedDataIds.set(cacheKey, dataId);

      // Return a JsonNode reconstructed from metadata
      return this.reconstructNodeFromMetadata(metadata);
    }

    throw new Error("Unexpected response type");
  }

  /**
   * Lazy load children for a specific node path
   */
  async lazyLoadChildren(
    dataId: string,
    path: string[],
    limit = 100
  ): Promise<JsonNode[]> {
    const response = await this.postMessage({
      type: "LAZY_LOAD_CHILDREN",
      payload: { dataId, path, limit },
    });

    if (response.type === "CHILDREN_LOADED") {
      return response.payload.children;
    }

    return [];
  }

  /**
   * Extract lightweight metadata from JsonNode for caching
   */
  private extractNodeMetadata(node: JsonNode): NodeMetadata {
    return {
      key: node.key,
      type: node.type,
      path: node.path,
      depth: node.depth,
      hasChildren: !!(node.children && node.children.length > 0),
      childrenCount: node.children?.length,
      isExpanded: node.isExpanded,
      valuePreview:
        node.type !== "object" && node.type !== "array"
          ? String(node.value).substring(0, 100)
          : undefined,
    };
  }

  /**
   * Reconstruct JsonNode from metadata (simplified version for large datasets)
   */
  private reconstructNodeFromMetadata(metadata: NodeMetadata): JsonNode {
    // This is a simplified reconstruction - in a full implementation,
    // you'd want to implement lazy loading where child nodes are loaded on demand
    const node: JsonNode = {
      key: metadata.key,
      value: metadata.valuePreview || (metadata.type === "object" ? {} : []),
      type: metadata.type as JsonNodeType,
      path: metadata.path,
      depth: metadata.depth,
      isExpanded: metadata.isExpanded,
    };

    // For large datasets, we implement lazy loading
    if (metadata.hasChildren && metadata.childrenCount) {
      // Create placeholder children that will be loaded on demand
      node.children = Array.from(
        { length: Math.min(metadata.childrenCount, 100) },
        (_, i) => ({
          key: `item_${i}`,
          value: "Loading...",
          type: "string" as JsonNodeType,
          path: [...metadata.path, `item_${i}`],
          depth: metadata.depth + 1,
          isExpanded: false,
        })
      );
    }

    return node;
  }

  async search(
    node: JsonNode,
    query: string,
    onProgress?: (progress: number, status: string) => void
  ): Promise<SearchResult[]> {
    const response = await this.postMessage(
      {
        type: "SEARCH",
        payload: { node, query },
      },
      onProgress
    );

    if (response.type === "SEARCH_RESULTS") {
      return response.payload.results;
    }

    throw new Error("Unexpected response type");
  }

  async searchWithRawJson(
    jsonString: string,
    query: string,
    onProgress?: (progress: number, status: string) => void
  ): Promise<SearchResult[]> {
    const response = await this.postMessage(
      {
        type: "SEARCH_RAW_JSON",
        payload: { jsonString, query },
      },
      onProgress
    );

    if (response.type === "SEARCH_RESULTS") {
      return response.payload.results;
    }

    throw new Error("Unexpected response type");
  }

  async searchStream(
    node: JsonNode,
    query: string,
    onResult: (result: SearchResult) => void,
    onProgress?: (progress: number, status: string) => void
  ): Promise<void> {
    await this.postMessage(
      {
        type: "SEARCH_STREAM",
        payload: { node, query },
      },
      onProgress,
      onResult
    );
  }

  async searchStreamWithRawJson(
    jsonString: string,
    query: string,
    onResult: (result: SearchResult) => void,
    onProgress?: (progress: number, status: string) => void
  ): Promise<void> {
    await this.postMessage(
      {
        type: "SEARCH_RAW_JSON_STREAM",
        payload: { jsonString, query },
      },
      onProgress,
      onResult
    );
  }

  async calculateStats(node: JsonNode): Promise<JsonStats> {
    const response = await this.postMessage({
      type: "CALCULATE_STATS",
      payload: { node },
    });

    if (response.type === "STATS_CALCULATED") {
      return response.payload.stats;
    }

    throw new Error("Unexpected response type");
  }

  terminate() {
    // Clean up memory management interval
    if (this.memoryCleanupInterval) {
      clearInterval(this.memoryCleanupInterval);
      this.memoryCleanupInterval = null;
    }

    // Terminate worker pool
    this.workerPool.terminate();

    // Clear all timeouts
    this.timeoutIds.forEach(clearTimeout);

    // Clear all maps and caches
    this.pendingCallbacks.clear();
    this.progressCallbacks.clear();
    this.streamCallbacks.clear();
    this.timeoutIds.clear();
    this.rejectCallbacks.clear();
    this.operationMetadata.clear();
    this.metadataCache.clear();
    this.parsedDataIds.clear();
    this.workerMessageMap.clear();

    // Reset memory tracking
    this.currentMemoryUsage = 0;
  }

  /**
   * Force immediate memory cleanup
   */
  forceCleanup(): void {
    this.cleanupMemory();
  }

  /**
   * Clear the parsed results cache
   */
  clearCache(): void {
    this.metadataCache.clear();
    this.parsedDataIds.clear();
    this.currentMemoryUsage = this.calculateCurrentMemoryUsage();
  }
}
