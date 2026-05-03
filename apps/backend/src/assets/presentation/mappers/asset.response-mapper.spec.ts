import { describe, expect, it } from "vitest";

import { Asset } from "@/assets/domain/entities/asset.entity";

import { AssetResponseMapper } from "./asset.response-mapper";

describe("AssetResponseMapper", () => {
  it("maps an asset to the response DTO shape", () => {
    const result = AssetResponseMapper.fromDomain(
      Asset.fromProps({
        id: 1n,
        publicId: "abc-123",
        namespaceId: 10n,
        policyVersionId: 20n,
        storageBindingId: 30n,
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
    });
  });

  it("maps content hash buffer to hex string", () => {
    const result = AssetResponseMapper.fromDomain(
      Asset.fromProps({
        id: 2n,
        publicId: "xyz-456",
        namespaceId: 10n,
        policyVersionId: 20n,
        storageBindingId: 30n,
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
  });
});
