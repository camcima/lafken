import { describe, expect, it } from "vitest";

import { Asset } from "@/assets/domain/entities/asset.entity";
import {
  type IPreviewSpec,
  PreviewUrlSignerPort,
} from "@/assets/domain/services/preview-url-signer.port";

import { AssetResponseMapper, type IPreviewSignContext } from "./asset.response-mapper";

class FakePreviewUrlSigner extends PreviewUrlSignerPort {
  sign(input: { sourceUrl: string; preset: IPreviewSpec }): string {
    return `https://imgproxy.test/sig/${input.preset.width ?? 0}x${input.preset.height ?? 0}/plain/${input.sourceUrl}`;
  }
}

function makeSignCtx(presets: Array<{ name: string; spec: IPreviewSpec }>): IPreviewSignContext {
  return {
    signer: new FakePreviewUrlSigner(),
    presets,
    sourceBaseUrl: "http://fake-gcs:4443",
    bucket: "lafken-dev",
  };
}

describe("AssetResponseMapper", () => {
  it("maps an asset to the response DTO shape", () => {
    const result = AssetResponseMapper.fromDomain(
      Asset.fromProps({
        id: "01900000-0000-7000-8000-000000000040",
        publicId: "abc-123",
        namespaceId: "01900000-0000-7000-8000-000000000010",
        policyVersionId: "01900000-0000-7000-8000-000000000020",
        storageBindingId: "01900000-0000-7000-8000-000000000001",
        storageKey: "uploads/abc-123",
        state: "ready",
        stateReason: null,
        sizeBytes: BigInt(1024),
        mimeType: "image/jpeg",
        declaredMimeType: "image/jpeg",
        width: 800,
        height: 600,
        contentHash: null,
        uploadedBy: "user@example.com",
        owningRecordType: null,
        owningRecordId: null,
        customMetadata: {},
        captureContext: null,
        legalHold: false,
        confirmedAt: null,
        stateChangedAt: new Date("2026-01-01T00:00:00Z"),
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-02T00:00:00Z"),
      }),
      "aircraft-photos",
      3,
    );

    expect(result).toEqual({
      publicId: "abc-123",
      namespaceSlug: "aircraft-photos",
      policyVersion: 3,
      state: "ready",
      stateReason: undefined,
      sizeBytes: 1024,
      mimeType: "image/jpeg",
      declaredMimeType: "image/jpeg",
      width: 800,
      height: 600,
      contentHashHex: undefined,
      uploadedBy: "user@example.com",
      owningRecordType: undefined,
      owningRecordId: undefined,
      customMetadata: {},
      captureContext: undefined,
      legalHold: false,
      confirmedAt: undefined,
      stateChangedAt: "2026-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      previewUrls: {},
    });
  });

  it("populates previewUrls from active presets when given a sign context", () => {
    const result = AssetResponseMapper.fromDomain(
      Asset.fromProps({
        id: "01900000-0000-7000-8000-000000000040",
        publicId: "abc-123",
        namespaceId: "01900000-0000-7000-8000-000000000010",
        policyVersionId: "01900000-0000-7000-8000-000000000020",
        storageBindingId: "01900000-0000-7000-8000-000000000001",
        storageKey: "aircraft-photos/assets/abc-123/source",
        state: "ready",
        stateReason: null,
        sizeBytes: BigInt(1024),
        mimeType: "image/jpeg",
        declaredMimeType: "image/jpeg",
        width: 800,
        height: 600,
        contentHash: null,
        uploadedBy: "user@example.com",
        owningRecordType: null,
        owningRecordId: null,
        customMetadata: {},
        captureContext: null,
        legalHold: false,
        confirmedAt: null,
        stateChangedAt: new Date("2026-01-01T00:00:00Z"),
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-02T00:00:00Z"),
      }),
      "aircraft-photos",
      3,
      makeSignCtx([
        {
          name: "thumb-sm",
          spec: { width: 200, height: 200, fit: "cover", format: "webp", quality: 80, dpr: null },
        },
        {
          name: "thumb-md",
          spec: { width: 400, height: 400, fit: "cover", format: "webp", quality: 80, dpr: null },
        },
      ]),
    );

    expect(result.previewUrls).toEqual({
      "thumb-sm":
        "https://imgproxy.test/sig/200x200/plain/http://fake-gcs:4443/lafken-dev/aircraft-photos/assets/abc-123/source",
      "thumb-md":
        "https://imgproxy.test/sig/400x400/plain/http://fake-gcs:4443/lafken-dev/aircraft-photos/assets/abc-123/source",
    });
  });

  it("returns an empty previewUrls map when the asset is not previewable", () => {
    const result = AssetResponseMapper.fromDomain(
      Asset.fromProps({
        id: "01900000-0000-7000-8000-000000000040",
        publicId: "abc-123",
        namespaceId: "01900000-0000-7000-8000-000000000010",
        policyVersionId: "01900000-0000-7000-8000-000000000020",
        storageBindingId: "01900000-0000-7000-8000-000000000001",
        storageKey: "aircraft-photos/assets/abc-123/source",
        state: "pending",
        stateReason: null,
        sizeBytes: null,
        mimeType: null,
        declaredMimeType: "image/jpeg",
        width: null,
        height: null,
        contentHash: null,
        uploadedBy: null,
        owningRecordType: null,
        owningRecordId: null,
        customMetadata: {},
        captureContext: null,
        legalHold: false,
        confirmedAt: null,
        stateChangedAt: new Date("2026-01-01T00:00:00Z"),
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      }),
      "aircraft-photos",
      3,
      makeSignCtx([
        {
          name: "thumb-sm",
          spec: { width: 200, height: 200, fit: "cover", format: "webp", quality: 80, dpr: null },
        },
      ]),
    );
    expect(result.previewUrls).toEqual({});
  });

  it("maps content hash buffer to hex string", () => {
    const result = AssetResponseMapper.fromDomain(
      Asset.fromProps({
        id: "01900000-0000-7000-8000-000000000041",
        publicId: "xyz-456",
        namespaceId: "01900000-0000-7000-8000-000000000010",
        policyVersionId: "01900000-0000-7000-8000-000000000020",
        storageBindingId: "01900000-0000-7000-8000-000000000001",
        storageKey: "uploads/xyz-456",
        state: "ready",
        stateReason: null,
        sizeBytes: null,
        mimeType: null,
        declaredMimeType: null,
        width: null,
        height: null,
        contentHash: Buffer.from("deadbeef", "hex"),
        uploadedBy: null,
        owningRecordType: null,
        owningRecordId: null,
        customMetadata: {},
        captureContext: null,
        legalHold: false,
        confirmedAt: null,
        stateChangedAt: new Date("2026-01-01T00:00:00Z"),
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      }),
      "my-namespace",
      1,
    );

    expect(result.contentHashHex).toBe("deadbeef");
    expect(result.previewUrls).toEqual({});
  });
});
