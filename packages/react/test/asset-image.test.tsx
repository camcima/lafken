import { render, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { _resetAssetImageCache, AssetImage, LafkenProvider } from "../src/index";

function makeStubClient(impl: {
  getPreviewUrl: (i: { publicId: string; preset: string }) => Promise<string>;
}) {
  return impl as unknown as Parameters<typeof LafkenProvider>[0]["client"];
}

afterEach(() => {
  _resetAssetImageCache();
});

describe("<AssetImage>", () => {
  it("renders an <img> with the resolved URL", async () => {
    const client = makeStubClient({
      getPreviewUrl: vi.fn().mockResolvedValue("https://cdn/x.webp"),
    });
    const { container } = render(
      <LafkenProvider client={client}>
        <AssetImage publicId="abc" preset="lafken:thumbnail" alt="a" />
      </LafkenProvider>,
    );
    await waitFor(() => {
      expect(container.querySelector("img")).not.toBeNull();
    });
    const img = container.querySelector("img")!;
    expect(img.getAttribute("src")).toBe("https://cdn/x.webp");
    expect(img.getAttribute("alt")).toBe("a");
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.getAttribute("decoding")).toBe("async");
  });

  it("renders nothing while loading", () => {
    const client = makeStubClient({
      getPreviewUrl: vi.fn().mockReturnValue(new Promise(() => {})),
    });
    const { container } = render(
      <LafkenProvider client={client}>
        <AssetImage publicId="abc" preset="lafken:thumbnail" alt="" />
      </LafkenProvider>,
    );
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders nothing on error (e.g., 404)", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("404"));
    const client = makeStubClient({ getPreviewUrl: fn });
    const { container } = render(
      <LafkenProvider client={client}>
        <AssetImage publicId="abc" preset="missing" alt="" />
      </LafkenProvider>,
    );
    await waitFor(() => {
      expect(fn.mock.calls.length).toBe(1);
    });
    expect(container.querySelector("img")).toBeNull();
  });

  it("dedupes concurrent fetches across multiple mounts of the same key", async () => {
    const fn = vi.fn().mockResolvedValue("https://cdn/x.webp");
    const client = makeStubClient({ getPreviewUrl: fn });
    render(
      <LafkenProvider client={client}>
        <AssetImage publicId="abc" preset="lafken:thumbnail" alt="" />
        <AssetImage publicId="abc" preset="lafken:thumbnail" alt="" />
        <AssetImage publicId="abc" preset="lafken:thumbnail" alt="" />
      </LafkenProvider>,
    );
    await waitFor(() => {
      expect(fn.mock.calls.length).toBe(1);
    });
  });

  it("accepts a client prop override (no provider)", async () => {
    const client = makeStubClient({
      getPreviewUrl: vi.fn().mockResolvedValue("https://cdn/y.webp"),
    });
    const { container } = render(
      <AssetImage
        client={client as Parameters<typeof AssetImage>[0]["client"]}
        publicId="abc"
        preset="lafken:thumbnail"
        alt=""
      />,
    );
    await waitFor(() => {
      expect(container.querySelector("img")).not.toBeNull();
    });
  });

  it("throws when used without a provider and without a client prop", () => {
    // Suppress the noisy React error boundary log.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(<AssetImage publicId="abc" preset="lafken:thumbnail" alt="" />)).toThrow(
        /LafkenProvider|client/u,
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("forwards arbitrary <img> attributes", async () => {
    const client = makeStubClient({
      getPreviewUrl: vi.fn().mockResolvedValue("https://cdn/x.webp"),
    });
    const { container } = render(
      <LafkenProvider client={client}>
        <AssetImage
          publicId="abc"
          preset="lafken:thumbnail"
          className="foo"
          data-testid="bar"
          alt=""
        />
      </LafkenProvider>,
    );
    await waitFor(() => {
      expect(container.querySelector("img")).not.toBeNull();
    });
    const img = container.querySelector("img")!;
    expect(img.getAttribute("class")).toBe("foo");
    expect(img.getAttribute("data-testid")).toBe("bar");
  });
});
