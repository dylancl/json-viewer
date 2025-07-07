import { useCallback } from "react";

export function useScrollToElement() {
  const scrollToElement = useCallback(
    (
      elementId: string,
      options: {
        behavior?: ScrollBehavior;
        block?: ScrollLogicalPosition;
        inline?: ScrollLogicalPosition;
        highlightClass?: string;
        highlightDuration?: number;
      } = {}
    ) => {
      const {
        behavior = "smooth",
        block = "center",
        inline = "nearest",
        highlightClass = "bg-yellow-100 border-yellow-300",
        highlightDuration = 2000,
      } = options;

      setTimeout(() => {
        const element = document.getElementById(elementId);
        if (element) {
          element.scrollIntoView({ behavior, block, inline });

          if (highlightClass) {
            const classes = highlightClass.split(" ");
            element.classList.add(...classes);
            setTimeout(() => {
              element.classList.remove(...classes);
            }, highlightDuration);
          }
        } else {
          console.warn(`Element with id "${elementId}" not found`);
        }
      }, 200);
    },
    []
  );

  return { scrollToElement };
}
