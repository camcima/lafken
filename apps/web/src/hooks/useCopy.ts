import { useCallback, useEffect, useRef, useState } from "react";

interface IUseCopyOptions {
  resetMs?: number;
}

interface IUseCopyReturn {
  copied: string | null;
  copy: (text: string) => Promise<void>;
}

const DEFAULT_RESET_MS = 1500;

export function useCopy(options: IUseCopyOptions = {}): IUseCopyReturn {
  const resetMs = options.resetMs ?? DEFAULT_RESET_MS;
  const [copied, setCopied] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const copy = useCallback(
    async (text: string): Promise<void> => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(text);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          setCopied(null);
        }, resetMs);
      } catch {
        setCopied(null);
      }
    },
    [resetMs],
  );

  return { copied, copy };
}
