import { useMemo } from "react";
import { JsonNode } from "@/types/json";

export function useJsonNodeStyling(node: JsonNode) {
  const typeColor = useMemo(() => {
    switch (node.type) {
      case "string":
        return "text-emerald-600 dark:text-emerald-400";
      case "number":
        return "text-blue-600 dark:text-blue-400";
      case "boolean":
        return "text-purple-600 dark:text-purple-400";
      case "null":
        return "text-muted-foreground";
      case "object":
        return "text-orange-600 dark:text-orange-400";
      case "array":
        return "text-indigo-600 dark:text-indigo-400";
      default:
        return "text-foreground";
    }
  }, [node.type]);

  const typeBadgeColor = useMemo(() => {
    switch (node.type) {
      case "string":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
      case "number":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
      case "boolean":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
      case "null":
        return "bg-muted text-muted-foreground";
      case "object":
        return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
      case "array":
        return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300";
      default:
        return "bg-muted text-muted-foreground";
    }
  }, [node.type]);

  return { typeColor, typeBadgeColor };
}
