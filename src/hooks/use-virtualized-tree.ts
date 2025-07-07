import { useCallback, useRef } from "react";
import { FixedSizeList as List } from "react-window";

type FlatNode = {
  node: {
    path: string[];
  };
};

export function useVirtualizedTree() {
  const listRef = useRef<List>(null);

  // Scroll to specific item (useful for search navigation)
  const scrollToItem = useCallback(
    (flatNodes: FlatNode[], targetPath: string[]) => {
      const targetIndex = flatNodes.findIndex(
        (flatNode) => flatNode.node.path.join(".") === targetPath.join(".")
      );

      if (targetIndex !== -1 && listRef.current) {
        listRef.current.scrollToItem(targetIndex, "center");
      }
    },
    []
  );

  // Scroll to top
  const scrollToTop = useCallback(() => {
    if (listRef.current) {
      listRef.current.scrollToItem(0, "start");
    }
  }, []);

  // Scroll by offset
  const scrollBy = useCallback((offset: number) => {
    if (listRef.current) {
      // Access the scrollTo method directly
      const scrollElement = (
        listRef.current as unknown as { _outerRef: HTMLElement }
      )._outerRef;
      if (scrollElement) {
        scrollElement.scrollTop += offset;
      }
    }
  }, []);

  return {
    listRef,
    scrollToItem,
    scrollToTop,
    scrollBy,
  };
}
