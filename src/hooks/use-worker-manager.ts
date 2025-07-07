import { useRef, useEffect } from "react";
import { JsonWorkerManager } from "@/lib/json-worker-manager";

export function useWorkerManager() {
  const workerRef = useRef<JsonWorkerManager | null>(null);

  useEffect(() => {
    workerRef.current = new JsonWorkerManager();
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  return workerRef.current;
}
