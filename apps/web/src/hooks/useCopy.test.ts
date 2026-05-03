import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useCopy } from "./useCopy";

describe("useCopy", () => {
  it("copies text and reports success briefly", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useCopy({ resetMs: 30 }));
    expect(result.current.copied).toBeNull();

    await act(async () => {
      await result.current.copy("hello");
    });
    expect(writeText).toHaveBeenCalledWith("hello");
    expect(result.current.copied).toBe("hello");
    await waitFor(() => {
      expect(result.current.copied).toBeNull();
    });
  });

  it("does not throw when clipboard rejects", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useCopy());
    await act(async () => {
      await result.current.copy("hello");
    });
    expect(result.current.copied).toBeNull();
  });
});
