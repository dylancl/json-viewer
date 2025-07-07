import { useCallback, useRef } from "react";

export function useDebouncedSearch<T extends unknown[]>(
  callback: (...args: T) => void | Promise<void>,
  delay: number | ((args: T) => number)
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentOperationRef = useRef<string>("");

  const debouncedCallback = useCallback(
    (...args: T) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      const operationId = Math.random().toString(36);
      currentOperationRef.current = operationId;

      const actualDelay = typeof delay === "function" ? delay(args) : delay;

      timeoutRef.current = setTimeout(async () => {
        if (currentOperationRef.current === operationId) {
          await callback(...args);
        }
      }, actualDelay);
    },
    [callback, delay]
  );

  const cancelPending = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    currentOperationRef.current = "";
  }, []);

  const isCurrentOperation = useCallback((operationId: string) => {
    return currentOperationRef.current === operationId;
  }, []);

  const getCurrentOperationId = useCallback(() => {
    return currentOperationRef.current;
  }, []);

  return {
    debouncedCallback,
    cancelPending,
    isCurrentOperation,
    getCurrentOperationId,
  };
}
