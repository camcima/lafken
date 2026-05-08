import { describe, expect, it } from "vitest";

import { Asset } from "@/assets/domain/entities/asset.entity";

import { AssetResponseMapper } from "./asset.response-mapper";

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
        phash: null,
        uploadedBy: "user@example.com",
        externalRefType: null,
        externalRefId: null,
        customMetadata: {},
        captureContext: null,
        tags: [],
        legalHold: false,
        legalHoldReference: null,
        confirmedAt: null,
        stateChangedAt: new Date("2026-01-01T00:00:00Z"),
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-02T00:00:00Z"),
      }),
      "aircraft-photos",
      3,
    );

    expect(result).toEqual({
      id: "01900000-0000-7000-8000-000000000040",
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
      phashHex: undefined,
      uploadedBy: "user@example.com",
      externalRefType: undefined,
      externalRefId: undefined,
      customMetadata: {},
      captureContext: undefined,
      tags: [],
      legalHold: false,
      legalHoldReference: null,
      confirmedAt: undefined,
      stateChangedAt: "2026-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
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
        phash: null,
        uploadedBy: null,
        externalRefType: null,
        externalRefId: null,
        customMetadata: {},
        captureContext: null,
        tags: [],
        legalHold: false,
        legalHoldReference: null,
        confirmedAt: null,
        stateChangedAt: new Date("2026-01-01T00:00:00Z"),
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      }),
      "my-namespace",
      1,
    );

    expect(result.contentHashHex).toBe("deadbeef");
  });
});
