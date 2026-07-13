import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UploadDropzone } from "../src/index";

const stubClient = {
  createUploadIntent: vi.fn(),
  confirmUpload: vi.fn(),
  refreshUploadUrl: vi.fn(),
};

// Spy target: capture constructor args without intercepting the full class.
const managerCtorArgs: unknown[] = [];
vi.mock("@lafken/upload", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@lafken/upload")>();
  const OriginalManager = mod.LafkenUploadManager;
  class SpiedManager extends OriginalManager {
    constructor(opts: ConstructorParameters<typeof OriginalManager>[0]) {
      managerCtorArgs.push(opts);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
      super(opts as any);
    }
  }
  return { ...mod, LafkenUploadManager: SpiedManager };
});

describe("UploadDropzone", () => {
  it("getInputProps produces a usable file input", () => {
    render(
      <UploadDropzone
        client={stubClient as unknown as Parameters<typeof UploadDropzone>[0]["client"]}
        namespaceSlug="ns"
        render={({ getInputProps }) => <input data-testid="file-input" {...getInputProps()} />}
      />,
    );
    const input = screen.getByTestId<HTMLInputElement>("file-input");
    expect(input.type).toBe("file");
    expect(input.multiple).toBe(true);
  });

  it("forwards refreshSafetyMarginMs to the manager", () => {
    const before = managerCtorArgs.length;
    render(
      <UploadDropzone
        client={stubClient as unknown as Parameters<typeof UploadDropzone>[0]["client"]}
        namespaceSlug="n"
        refreshSafetyMarginMs={45_000}
        render={() => null}
      />,
    );
    const calls = managerCtorArgs.slice(before);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ refreshSafetyMarginMs: 45_000 });
    expect(calls[0]).not.toHaveProperty("protocol");
  });

  it("forwards pollingIntervalMs, pollingMaxIntervalMs, pollingTimeoutMs to the manager", () => {
    const before = managerCtorArgs.length;
    render(
      <UploadDropzone
        client={stubClient as unknown as Parameters<typeof UploadDropzone>[0]["client"]}
        namespaceSlug="n"
        pollingIntervalMs={500}
        pollingMaxIntervalMs={5_000}
        pollingTimeoutMs={60_000}
        render={() => null}
      />,
    );
    const calls = managerCtorArgs.slice(before);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      pollingIntervalMs: 500,
      pollingMaxIntervalMs: 5_000,
      pollingTimeoutMs: 60_000,
    });
  });

  it("dropping a file calls addFiles internally (state idle)", () => {
    render(
      <UploadDropzone
        client={stubClient as unknown as Parameters<typeof UploadDropzone>[0]["client"]}
        namespaceSlug="ns"
        render={({ files, getRootProps }) => (
          <div data-testid="zone" {...getRootProps()}>
            count: {files.length}
          </div>
        )}
      />,
    );
    const zone = screen.getByTestId("zone");
    const file = new File([new Uint8Array([1])], "a.jpg", { type: "image/jpeg" });
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    expect(zone.textContent).toContain("count: 1");
  });
});
