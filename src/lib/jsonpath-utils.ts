import { JSONPath } from "jsonpath-plus";
import { JsonValue, JsonNode, SearchResult } from "@/types/json";

export interface JSONPathResult {
  path: string;
  value: JsonValue;
  parent: JsonValue | null;
  parentProperty: string | number | null;
  pointer: string;
}

export interface JSONPathValidationResult {
  isValid: boolean;
  isPartiallyValid: boolean;
  error?: string;
  suggestion?: string;
}

/**
 * Check if a string is a valid JSONPath expression with detailed validation result
 */
export function validateJSONPath(expression: string): JSONPathValidationResult {
  const trimmed = expression.trim();

  if (!trimmed) {
    return {
      isValid: false,
      isPartiallyValid: false,
      error: "Expression cannot be empty",
    };
  }

  if (!trimmed.startsWith("$")) {
    return {
      isValid: false,
      isPartiallyValid: false,
      error: "JSONPath expressions must start with '$'",
      suggestion:
        "Try: $" + (trimmed.startsWith(".") ? trimmed : "." + trimmed),
    };
  }

  // Single $ is valid as root
  if (trimmed === "$") {
    return {
      isValid: true,
      isPartiallyValid: true,
    };
  }

  // Check for common syntax errors
  const syntaxErrors = checkJSONPathSyntax(trimmed);
  if (syntaxErrors.length > 0) {
    return {
      isValid: false,
      isPartiallyValid: true,
      error: syntaxErrors[0],
      suggestion: "Check your bracket notation and filter expressions",
    };
  }

  // Check for incomplete expressions that might be valid when completed
  if (isIncompleteExpression(trimmed)) {
    return {
      isValid: false,
      isPartiallyValid: true,
      error: "Expression appears incomplete",
      suggestion: "Continue typing to complete the expression",
    };
  }

  try {
    // Try to parse the expression by running it on a simple test object
    JSONPath({
      path: trimmed,
      json: { test: "value", items: [1, 2, 3] },
      wrap: false,
    });
    return {
      isValid: true,
      isPartiallyValid: true,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return {
      isValid: false,
      isPartiallyValid: false,
      error: `Invalid JSONPath syntax: ${errorMessage}`,
      suggestion: "Check the JSONPath documentation for correct syntax",
    };
  }
}

/**
 * Check for common JSONPath syntax errors
 */
function checkJSONPathSyntax(expression: string): string[] {
  const errors: string[] = [];

  // Check for unmatched brackets
  let bracketCount = 0;
  let inQuotes = false;
  let quoteChar = "";

  for (let i = 0; i < expression.length; i++) {
    const char = expression[i];
    const prevChar = i > 0 ? expression[i - 1] : "";

    if (!inQuotes && (char === '"' || char === "'")) {
      inQuotes = true;
      quoteChar = char;
    } else if (inQuotes && char === quoteChar && prevChar !== "\\") {
      inQuotes = false;
      quoteChar = "";
    } else if (!inQuotes) {
      if (char === "[") {
        bracketCount++;
      } else if (char === "]") {
        bracketCount--;
        if (bracketCount < 0) {
          errors.push("Unmatched closing bracket ']'");
          break;
        }
      }
    }
  }

  if (bracketCount > 0) {
    errors.push("Unmatched opening bracket '['");
  }

  if (inQuotes) {
    errors.push(`Unterminated quoted string (${quoteChar})`);
  }

  // Check for invalid filter expressions
  const filterRegex = /\[\?\([^)]*\)/g;
  let match;
  while ((match = filterRegex.exec(expression)) !== null) {
    const filterExpr = match[0];
    if (!filterExpr.includes("@")) {
      errors.push(
        "Filter expressions should contain '@' to reference current item"
      );
    }
  }

  return errors;
}

/**
 * Check if an expression looks like it's being typed and might be valid when completed
 */
function isIncompleteExpression(expression: string): boolean {
  // Allow incomplete bracket notation like $.users[
  if (/\[[^\]]*$/.test(expression)) return true;

  // Allow incomplete filter expressions like $.users[?(@.name
  if (/\[\?\(@\.[^)]*$/.test(expression)) return true;

  // Allow incomplete quoted strings in brackets
  if (/\[["'][^"']*$/.test(expression)) return true;

  // Allow trailing dots
  if (expression.endsWith(".")) return true;

  return false;
}

/**
 * Check if a string is a valid JSONPath expression (legacy function for backward compatibility)
 */
export function isValidJSONPath(expression: string): boolean {
  const result = validateJSONPath(expression);
  return result.isValid;
}

/**
 * Check if a string is a potentially valid JSONPath expression (more lenient for partial input)
 */
export function isValidPartialJSONPath(expression: string): boolean {
  const result = validateJSONPath(expression);
  return result.isValid || result.isPartiallyValid;
}

/**
 * Execute a JSONPath query against the JSON data
 */
export function executeJSONPath(
  jsonData: JsonValue,
  expression: string,
  options: {
    maxResults?: number;
    includeParentInfo?: boolean;
  } = {}
): JSONPathResult[] {
  const { maxResults = 1000, includeParentInfo = true } = options;

  try {
    const validation = validateJSONPath(expression);
    if (!validation.isValid) {
      throw new Error(validation.error || "Invalid JSONPath expression");
    }

    const results = JSONPath({
      path: expression,
      json: jsonData,
      resultType: "all",
      wrap: false,
    });

    // Handle the case where results might not be an array
    const resultArray = Array.isArray(results)
      ? results
      : results
      ? [results]
      : [];

    return resultArray.slice(0, maxResults).map(
      (result): JSONPathResult => ({
        path: result.path || "",
        value: result.value,
        parent: includeParentInfo ? result.parent : null,
        parentProperty: includeParentInfo ? result.parentProperty : null,
        pointer: result.pointer || "",
      })
    );
  } catch (error) {
    throw new Error(
      `JSONPath execution failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Convert JSONPath expression result to our internal SearchResult format
 */
export function convertJSONPathToSearchResults(
  jsonPathResults: JSONPathResult[],
  originalExpression: string,
  rootNode: JsonNode
): SearchResult[] {
  const searchResults: SearchResult[] = [];

  for (const result of jsonPathResults) {
    try {
      // Convert JSONPath path format to our internal path format
      const pathSegments = convertJSONPathToInternalPath(result.path);

      // Find the corresponding node in our tree
      const targetNode = findNodeByPath(rootNode, pathSegments);

      if (targetNode) {
        searchResults.push({
          path: targetNode.path,
          key: targetNode.key,
          value: result.value,
          type: targetNode.type,
          matchType: "jsonpath",
          jsonPath: originalExpression,
          pathExpression: result.path,
        });
      }
    } catch (error) {
      console.warn("Failed to convert JSONPath result:", error);
      // Continue with other results
    }
  }

  return searchResults;
}

/**
 * Convert JSONPath path format (like "$.users[0].name") to our internal path array
 */
function convertJSONPathToInternalPath(jsonPath: string): string[] {
  // Remove the leading $ and split by dots and brackets
  const withoutRoot = jsonPath.replace(/^\$\.?/, "");
  if (!withoutRoot) return [];

  const segments: string[] = [];
  let current = "";
  let inBrackets = false;
  let bracketContent = "";

  for (let i = 0; i < withoutRoot.length; i++) {
    const char = withoutRoot[i];

    if (char === "[" && !inBrackets) {
      if (current) {
        segments.push(current);
        current = "";
      }
      inBrackets = true;
      bracketContent = "";
    } else if (char === "]" && inBrackets) {
      // Handle array index or quoted property
      if (bracketContent.startsWith('"') && bracketContent.endsWith('"')) {
        // Quoted property name
        segments.push(bracketContent.slice(1, -1));
      } else if (
        bracketContent.startsWith("'") &&
        bracketContent.endsWith("'")
      ) {
        // Single quoted property name
        segments.push(bracketContent.slice(1, -1));
      } else {
        // Array index
        segments.push(bracketContent);
      }
      inBrackets = false;
      bracketContent = "";
    } else if (char === "." && !inBrackets) {
      if (current) {
        segments.push(current);
        current = "";
      }
    } else if (inBrackets) {
      bracketContent += char;
    } else {
      current += char;
    }
  }

  if (current) {
    segments.push(current);
  }

  return segments;
}

/**
 * Find a node in the tree by path
 */
function findNodeByPath(
  rootNode: JsonNode,
  pathSegments: string[]
): JsonNode | null {
  let currentNode = rootNode;

  for (const segment of pathSegments) {
    if (!currentNode.children) return null;

    const child = currentNode.children.find((child) => child.key === segment);
    if (!child) return null;

    currentNode = child;
  }

  return currentNode;
}

/**
 * Get suggestions for JSONPath expressions based on the JSON structure
 */
export function getJSONPathSuggestions(rootNode: JsonNode): string[] {
  const suggestions: string[] = [];

  // Add basic suggestions
  suggestions.push(
    "$", // Root
    "$.*", // All properties at root level
    "$..*", // All descendant properties
    "$..value", // All properties named 'value'
    "$[*]" // All array elements (if root is array)
  );

  // Analyze structure to provide more specific suggestions
  if (rootNode.children) {
    // Add suggestions for direct children
    rootNode.children.forEach((child) => {
      if (child.key) {
        suggestions.push(`$.${child.key}`);
        if (child.type === "array") {
          suggestions.push(`$.${child.key}[*]`);
          suggestions.push(`$.${child.key}[0]`);
        } else if (child.type === "object") {
          suggestions.push(`$.${child.key}.*`);
        }
      }
    });
  }

  return suggestions;
}

export interface JSONPathAutocompleteSuggestion {
  text: string;
  label: string;
  description: string;
  insertText: string;
  cursorOffset?: number; // Offset from end of insertText where cursor should be placed
}

/**
 * Get autocomplete suggestions for JSONPath expressions based on current input and JSON structure
 */
export function getJSONPathAutocompleteSuggestions(
  currentInput: string,
  rootNode: JsonNode,
  cursorPosition?: number
): JSONPathAutocompleteSuggestion[] {
  const suggestions: JSONPathAutocompleteSuggestion[] = [];
  const trimmed = currentInput.trim();
  const actualPosition = cursorPosition ?? trimmed.length;

  // Get the text up to cursor position
  const textToCursor = trimmed.substring(0, actualPosition);
  // const textAfterCursor = trimmed.substring(actualPosition);

  // If empty or just starting, suggest basic patterns
  if (!textToCursor || textToCursor === "$") {
    suggestions.push(
      {
        text: "$",
        label: "$ - Root",
        description: "Root element of the JSON",
        insertText: "$",
      },
      {
        text: "$.*",
        label: "$. - Properties",
        description: "All properties at root level",
        insertText: "$.",
      },
      {
        text: "$..*",
        label: "$.. - Recursive",
        description: "All descendant properties recursively",
        insertText: "$..",
      }
    );

    if (rootNode.type === "array") {
      suggestions.push({
        text: "$[*]",
        label: "$[*] - Array elements",
        description: "All elements in root array",
        insertText: "$[*]",
      });
    }
  }

  // Analyze the current path context
  const pathContext = analyzeJSONPathContext(textToCursor, rootNode);

  if (pathContext) {
    // Add context-specific suggestions
    suggestions.push(...getContextualSuggestions(pathContext));
  }

  // Add common patterns and filters
  if (textToCursor.includes("[") && !textToCursor.includes("]")) {
    suggestions.push(
      {
        text: "*",
        label: "* - All elements",
        description: "Select all array elements",
        insertText: "*]",
      },
      {
        text: "0",
        label: "0 - First element",
        description: "Select first array element",
        insertText: "0]",
      },
      {
        text: "-1",
        label: "-1 - Last element",
        description: "Select last array element",
        insertText: "-1]",
      },
      {
        text: "?(@.",
        label: "?(@. - Filter",
        description: "Filter array elements by condition",
        insertText: "?(@.",
        cursorOffset: 0,
      }
    );
  }

  // Add filter condition suggestions
  if (textToCursor.includes("?(@.")) {
    const filterContext = extractFilterContext(textToCursor);
    if (filterContext) {
      suggestions.push(...getFilterSuggestions(filterContext));
    }
  }

  return suggestions.slice(0, 10); // Limit to 10 suggestions
}

interface JSONPathContext {
  segments: string[];
  currentSegment: string;
  isInBrackets: boolean;
  isInFilter: boolean;
  currentNode: JsonNode | null;
}

function analyzeJSONPathContext(
  input: string,
  rootNode: JsonNode
): JSONPathContext | null {
  try {
    // Remove leading $ and parse the path
    const withoutRoot = input.replace(/^\$\.?/, "");
    if (!withoutRoot && input === "$") {
      return {
        segments: [],
        currentSegment: "",
        isInBrackets: false,
        isInFilter: false,
        currentNode: rootNode,
      };
    }

    const segments: string[] = [];
    let currentSegment = "";
    let inBrackets = false;
    let inFilter = false;
    let bracketContent = "";

    for (let i = 0; i < withoutRoot.length; i++) {
      const char = withoutRoot[i];

      if (char === "[" && !inBrackets) {
        if (currentSegment) {
          segments.push(currentSegment);
          currentSegment = "";
        }
        inBrackets = true;
        bracketContent = "";
      } else if (char === "]" && inBrackets) {
        if (bracketContent) {
          segments.push(bracketContent);
        }
        inBrackets = false;
        inFilter = false;
        bracketContent = "";
      } else if (char === "." && !inBrackets) {
        if (currentSegment) {
          segments.push(currentSegment);
          currentSegment = "";
        }
      } else if (inBrackets) {
        bracketContent += char;
        if (bracketContent.includes("?(")) {
          inFilter = true;
        }
      } else {
        currentSegment += char;
      }
    }

    // Find the current node in the tree
    let currentNode: JsonNode | null = rootNode;
    for (const segment of segments) {
      if (!currentNode?.children) {
        currentNode = null;
        break;
      }
      const child: JsonNode | undefined = currentNode.children.find(
        (childNode: JsonNode) => childNode.key === segment
      );
      if (!child) {
        currentNode = null;
        break;
      }
      currentNode = child;
    }

    return {
      segments,
      currentSegment: inBrackets ? bracketContent : currentSegment,
      isInBrackets: inBrackets,
      isInFilter: inFilter,
      currentNode,
    };
  } catch {
    return null;
  }
}

function getContextualSuggestions(
  context: JSONPathContext
): JSONPathAutocompleteSuggestion[] {
  const suggestions: JSONPathAutocompleteSuggestion[] = [];

  if (!context.currentNode) return suggestions;

  if (context.isInBrackets) {
    // In array context
    if (context.currentNode.type === "array") {
      suggestions.push(
        {
          text: "*",
          label: "* - All elements",
          description: "Select all array elements",
          insertText: "*",
        },
        {
          text: "0",
          label: "0 - First",
          description: "First array element",
          insertText: "0",
        }
      );
    }
  } else {
    // In object property context
    if (context.currentNode.children) {
      context.currentNode.children.forEach((child) => {
        if (child.key && child.key.startsWith(context.currentSegment)) {
          const remaining = child.key.substring(context.currentSegment.length);
          suggestions.push({
            text: child.key,
            label: `${child.key} (${child.type})`,
            description: `${child.type} property`,
            insertText: remaining,
          });
        }
      });
    }

    // Add wildcard and recursive suggestions
    if (!context.currentSegment) {
      suggestions.push(
        {
          text: "*",
          label: "* - All properties",
          description: "All properties at this level",
          insertText: "*",
        },
        {
          text: "..",
          label: ".. - Recursive",
          description: "Search recursively in all descendants",
          insertText: "..",
        }
      );
    }
  }

  return suggestions;
}

function extractFilterContext(input: string): { property: string } | null {
  const match = input.match(/\?\(@\.([^)\s]*)/);
  return match ? { property: match[1] } : null;
}

function getFilterSuggestions(filterContext: {
  property: string;
}): JSONPathAutocompleteSuggestion[] {
  const suggestions: JSONPathAutocompleteSuggestion[] = [];

  // Add common filter operators
  suggestions.push(
    {
      text: "==",
      label: "== - Equals",
      description: "Filter by equality",
      insertText: " == ",
      cursorOffset: 0,
    },
    {
      text: "!=",
      label: "!= - Not equals",
      description: "Filter by inequality",
      insertText: " != ",
      cursorOffset: 0,
    },
    {
      text: ">",
      label: "> - Greater than",
      description: "Filter by greater than",
      insertText: " > ",
      cursorOffset: 0,
    },
    {
      text: "<",
      label: "< - Less than",
      description: "Filter by less than",
      insertText: " < ",
      cursorOffset: 0,
    }
  );

  // Add existence check
  if (filterContext.property) {
    suggestions.push({
      text: "exists",
      label: `${filterContext.property} - Exists`,
      description: "Check if property exists",
      insertText: ")",
    });
  }

  return suggestions;
}

/**
 * Validate and format a JSONPath expression
 */
export function formatJSONPath(expression: string): string {
  const trimmed = expression.trim();

  // Add $ prefix if missing
  if (!trimmed.startsWith("$")) {
    return `$.${trimmed}`;
  }

  return trimmed;
}

/**
 * Get examples of common JSONPath expressions
 */
export function getJSONPathExamples(): Array<{
  expression: string;
  description: string;
}> {
  return [
    { expression: "$", description: "Root element" },
    { expression: "$.store.book[*].author", description: "All book authors" },
    {
      expression: "$..author",
      description: "All authors (anywhere in the document)",
    },
    { expression: "$.store.*", description: "All things in store" },
    { expression: "$.store..price", description: "All prices in store" },
    { expression: "$..book[2]", description: "The third book" },
    { expression: "$..book[-1]", description: "The last book" },
    { expression: "$..book[0,1]", description: "First two books" },
    { expression: "$..book[:2]", description: "First two books (slice)" },
    {
      expression: "$..book[?(@.price < 10)]",
      description: "Books with price less than 10",
    },
    {
      expression: "$..book[?(@.price)]",
      description: "Books that have a price",
    },
    {
      expression: "$..*[?(@.name)]",
      description: "All items with a name property",
    },
  ];
}
