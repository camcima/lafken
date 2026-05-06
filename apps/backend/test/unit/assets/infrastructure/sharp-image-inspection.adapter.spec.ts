import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { SharpImageInspectionAdapter } from "@/assets/infrastructure/services/sharp-image-inspection.adapter";

describe("SharpImageInspectionAdapter", () => {
  it("accepts a valid PNG and returns derived metadata", async () => {
    const adapter = new SharpImageInspectionAdapter();
    const bytes = await sharp({
      create: {
        width: 2,
        height: 3,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

    const result = await adapter.inspect({
      bytes,
      declaredMimeType: "image/png",
      allowedMimeTypes: ["image/png"],
    });

    expect(result.decision).toBe("pass");
    expect(result.actualMimeType).toBe("image/png");
    expect(result.width).toBe(2);
    expect(result.height).toBe(3);
    expect(result.sizeBytes).toBe(BigInt(bytes.length));
    expect(result.contentHash.toString("hex")).toHaveLength(64);
    expect(result.findings["duration_ms"]).toBeTypeOf("number");
  });

  it("rejects bytes that sharp cannot parse", async () => {
    const adapter = new SharpImageInspectionAdapter();

    const result = await adapter.inspect({
      bytes: Buffer.from("not-an-image"),
      declaredMimeType: "image/png",
      allowedMimeTypes: ["image/png"],
    });

    expect(result.decision).toBe("error");
    expect(result.reason).toBe("invalid_image_format");
    expect(result.actualMimeType).toBeNull();
  });

  it("rejects an actual MIME type that is not allowed by the policy", async () => {
    const adapter = new SharpImageInspectionAdapter();
    const bytes = await sharp({
      create: {
        width: 1,
        height: 1,
        channels: 3,
        background: { r: 0, g: 0, b: 255 },
      },
    })
      .jpeg()
      .toBuffer();

    const result = await adapter.inspect({
      bytes,
      declaredMimeType: "image/jpeg",
      allowedMimeTypes: ["image/png"],
    });

    expect(result.decision).toBe("error");
    expect(result.reason).toBe("mime_type_not_allowed");
    expect(result.actualMimeType).toBe("image/jpeg");
  });

  it("rejects images that exceed the input pixel cap instead of hanging the worker", async () => {
    const adapter = new SharpImageInspectionAdapter();
    // 7000x7000 = 49 MP, well above the 24 MP defensive cap.
    const bytes = await sharp({
      create: {
        width: 7000,
        height: 7000,
        channels: 3,
        background: { r: 128, g: 128, b: 128 },
      },
    })
      .png()
      .toBuffer();

    const result = await adapter.inspect({
      bytes,
      declaredMimeType: "image/png",
      allowedMimeTypes: ["image/png"],
    });

    expect(result.decision).toBe("error");
    expect(result.reason).toBe("invalid_image_format");
  });
});
