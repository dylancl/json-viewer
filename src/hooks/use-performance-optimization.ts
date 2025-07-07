import { useMemo } from "react";
import { JsonNode } from "@/types/json";

const MAX_RENDER_DEPTH = 15;
const MAX_CHILDREN_COUNT = 500;
const LARGE_DATASET_INITIAL_RENDER_COUNT = 100;

export function usePerformanceOptimization(
  node: JsonNode,
  isExpanded: boolean
) {
  const { shouldRenderChildren, childrenToRender, isLargeDataset } =
    useMemo(() => {
      const { depth, children } = node;
      const childrenLength = children?.length ?? 0;

      const canRender = isExpanded && depth < MAX_RENDER_DEPTH;
      const isLarge = childrenLength > MAX_CHILDREN_COUNT;

      if (!canRender) {
        return {
          shouldRenderChildren: false,
          childrenToRender: 0,
          isLargeDataset: false,
        };
      }

      if (isLarge) {
        return {
          shouldRenderChildren: true,
          childrenToRender: LARGE_DATASET_INITIAL_RENDER_COUNT,
          isLargeDataset: true,
        };
      }

      return {
        shouldRenderChildren: true,
        childrenToRender: childrenLength,
        isLargeDataset: false,
      };
    }, [isExpanded, node]);

  return {
    shouldRenderChildren,
    childrenToRender,
    isLargeDataset,
  };
}
