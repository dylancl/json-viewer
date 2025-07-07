import { useMemo } from "react";
import { JsonNode } from "@/types/json";

type ValueDisplayInfo = {
  display: string;
  full: string;
  isTruncated: boolean;
};

export function useJsonNodeDisplay(node: JsonNode) {
  const valueInfo = useMemo((): ValueDisplayInfo => {
    switch (node.type) {
      case "string": {
        const stringValue = node.value as string;
        if (stringValue.length > 100) {
          return {
            display: `"${stringValue.slice(0, 100)}..." (${
              stringValue.length
            } chars)`,
            full: `"${stringValue}"`,
            isTruncated: true,
          };
        }
        return {
          display: `"${stringValue}"`,
          full: `"${stringValue}"`,
          isTruncated: false,
        };
      }
      case "number":
      case "boolean": {
        const value = String(node.value);
        return { display: value, full: value, isTruncated: false };
      }
      case "null":
        return { display: "null", full: "null", isTruncated: false };
      case "object": {
        const objValue = node.value as object;
        const keyCount = Object.keys(objValue).length;
        const display = node.isExpanded
          ? "{"
          : keyCount === 0
          ? "{}"
          : `{${keyCount} ${keyCount === 1 ? "property" : "properties"}}`;
        return { display, full: display, isTruncated: false };
      }
      case "array": {
        const arrValue = node.value as unknown[];
        const length = arrValue.length;
        const display = node.isExpanded
          ? "["
          : length === 0
          ? "[]"
          : `[${length} ${length === 1 ? "item" : "items"}]`;
        return { display, full: display, isTruncated: false };
      }
      default: {
        const value = String(node.value);
        return { display: value, full: value, isTruncated: false };
      }
    }
  }, [node.value, node.type, node.isExpanded]);

  return valueInfo;
}
