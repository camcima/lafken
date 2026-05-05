import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UploadDropzone } from "../src/index";

const stubClient = {
  createUploadIntent: vi.fn(),
  confirmUpload: vi.fn(),
};

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
