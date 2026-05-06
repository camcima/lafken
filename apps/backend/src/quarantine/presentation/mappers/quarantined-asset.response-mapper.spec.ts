import { describe, expect, it } from "vitest";

import { QuarantinedAssetView } from "@/quarantine/domain/entities/quarantined-asset-view.entity";

import { QuarantinedAssetResponseMapper } from "./quarantined-asset.response-mapper";

describe("QuarantinedAssetResponseMapper", () => {
  it("maps a quarantined-virus view to the response DTO shape", () => {
    const flaggedAt = new Date("2026-03-01T10:00:00Z");
    const stateChangedAt = new Date("2026-03-01T10:00:00Z");
    const createdAt = new Date("2026-01-15T08:00:00Z");

    const result = QuarantinedAssetResponseMapper.fromDomain(
      QuarantinedAssetView.fromProps({
        publicId: "abc-123",
        namespaceSlug: "aircraft-photos",
        policyVersion: 3,
        state: "quarantined_virus",
        stateReason: null,
        sizeBytes: BigInt(2048),
        mimeType: "image/jpeg",
        declaredMimeType: "image/jpeg",
        width: 1920,
        height: 1080,
        contentHash: null,
        uploadedBy: "user@example.com",
        externalRefType: null,
        externalRefId: null,
        customMetadata: {},
        captureContext: null,
        legalHold: false,
        confirmedAt: null,
        stateChangedAt,
        createdAt,
        quarantineKind: "virus",
        flaggedAnalyzer: null,
        flaggedCategory: null,
        flaggedScore: null,
        flaggedAt,
      }),
    );

    expect(result).toEqual({
      publicId: "abc-123",
      namespaceSlug: "aircraft-photos",
      policyVersion: 3,
      state: "quarantined_virus",
      stateReason: undefined,
      sizeBytes: 2048,
      mimeType: "image/jpeg",
      declaredMimeType: "image/jpeg",
      width: 1920,
      height: 1080,
      contentHashHex: undefined,
      uploadedBy: "user@example.com",
      externalRefType: undefined,
      externalRefId: undefined,
      customMetadata: {},
      captureContext: undefined,
      legalHold: false,
      confirmedAt: undefined,
      stateChangedAt: stateChangedAt.toISOString(),
      createdAt: createdAt.toISOString(),
      quarantineKind: "virus",
      flaggedAnalyzer: undefined,
      flaggedCategory: undefined,
      flaggedScore: undefined,
      flaggedAt: flaggedAt.toISOString(),
    });
  });

  it("maps a quarantined-moderation view with quarantineKind = moderation", () => {
    const flaggedAt = new Date("2026-04-10T12:00:00Z");

    const result = QuarantinedAssetResponseMapper.fromDomain(
      QuarantinedAssetView.fromProps({
        publicId: "xyz-456",
        namespaceSlug: "user-uploads",
        policyVersion: 1,
        state: "quarantined_moderation",
        stateReason: null,
        sizeBytes: null,
        mimeType: null,
        declaredMimeType: null,
        width: null,
        height: null,
        contentHash: null,
        uploadedBy: null,
        externalRefType: null,
        externalRefId: null,
        customMetadata: {},
        captureContext: null,
        legalHold: false,
        confirmedAt: null,
        stateChangedAt: flaggedAt,
        createdAt: new Date("2026-04-10T11:00:00Z"),
        quarantineKind: "moderation",
        flaggedAnalyzer: null,
        flaggedCategory: null,
        flaggedScore: null,
        flaggedAt,
      }),
    );

    expect(result.quarantineKind).toBe("moderation");
    expect(result.flaggedAt).toBe(flaggedAt.toISOString());
  });
});
