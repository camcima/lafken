import type { LafkenClient } from "@lafken/client";
import { renderHook } from "@testing-library/react";
import React, { type ReactNode, useContext } from "react";
import { describe, expect, it } from "vitest";

import { _LafkenClientContext, LafkenProvider, useLafkenClient } from "../src/index";

const stubClient = {
  createUploadIntent: () => undefined,
  confirmUpload: () => undefined,
} as unknown as LafkenClient;

describe("LafkenProvider", () => {
  it("supplies the client to descendants via useLafkenClient", () => {
    const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
      <LafkenProvider client={stubClient}>{children}</LafkenProvider>
    );
    const { result } = renderHook(() => useLafkenClient(), { wrapper });
    expect(result.current).toBe(stubClient);
  });

  it("throws when useLafkenClient is called outside a LafkenProvider", () => {
    expect(() => renderHook(() => useLafkenClient())).toThrowError(/LafkenProvider/);
  });

  it("exposes _LafkenClientContext for direct consumption via useContext", () => {
    const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
      <LafkenProvider client={stubClient}>{children}</LafkenProvider>
    );
    const { result } = renderHook(() => useContext(_LafkenClientContext), { wrapper });
    expect(result.current).toBe(stubClient);
  });

  it("returns null from _LafkenClientContext when no provider is present", () => {
    const { result } = renderHook(() => useContext(_LafkenClientContext));
    expect(result.current).toBeNull();
  });
});
