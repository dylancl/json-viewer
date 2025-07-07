export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonObject
  | JsonArray;

export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];

export type JsonNodeType =
  | "object"
  | "array"
  | "string"
  | "number"
  | "boolean"
  | "null";

export type JsonNode = {
  key?: string;
  value: JsonValue;
  type: JsonNodeType;
  path: string[];
  depth: number;
  isExpanded?: boolean;
  parent?: JsonNode;
  children?: JsonNode[];
  index?: number;
};

export type ViewMode = "tree" | "raw" | "formatted";

export type JsonViewerConfig = {
  viewMode: ViewMode;
  showLineNumbers: boolean;
  showDataTypes: boolean;
  highlightSearch: boolean;
  collapseLevel: number;
  theme: "light" | "dark" | "auto";
  enableVirtualization: boolean;
  virtualizationThreshold: number;
};

export type SearchResult = {
  path: string[];
  key?: string;
  value: JsonValue;
  type: JsonNodeType;
  matchType: "key" | "value" | "jsonpath";
  jsonPath?: string; // The JSONPath expression that matched
  pathExpression?: string; // The actual path expression for this result
};

export type JsonStats = {
  totalKeys: number;
  totalValues: number;
  depth: number;
  size: number;
  objectCount: number;
  arrayCount: number;
  stringCount: number;
  numberCount: number;
  booleanCount: number;
  nullCount: number;
};
