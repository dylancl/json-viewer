import { useMemo } from "react";
import { JsonNode } from "@/types/json";

export function useLineNumbers(node: JsonNode, showLineNumbers: boolean) {
  const lineNumbers = useMemo(() => {
    if (!showLineNumbers) return new Map<string, number>();

    const lineNumberMap = new Map<string, number>();
    let currentLine = 1;

    function traverse(currentNode: JsonNode) {
      const pathKey = currentNode.path.join("-");
      lineNumberMap.set(pathKey, currentLine++);

      if (currentNode.isExpanded && currentNode.children) {
        currentNode.children.forEach((child) => traverse(child));

        if (currentNode.type === "object" || currentNode.type === "array") {
          const closingPathKey = `${pathKey}-closing`;
          lineNumberMap.set(closingPathKey, currentLine++);
        }
      }
    }

    traverse(node);
    return lineNumberMap;
  }, [node, showLineNumbers]);

  return lineNumbers;
}
