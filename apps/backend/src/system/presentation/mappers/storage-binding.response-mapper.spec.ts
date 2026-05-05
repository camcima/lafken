import { describe, expect, it } from "vitest";

import { StorageBinding } from "@/system/domain/entities/storage-binding.entity";

import { StorageBindingResponseMapper } from "./storage-binding.response-mapper";

describe("StorageBindingResponseMapper", () => {
  it("maps a GCS storage binding to its response DTO with all fields", () => {
    const binding = StorageBinding.fromProps({
      id: "01900000-0000-7000-8000-000000000001",
      name: "gcs-prod",
      adapterType: "gcs",
      config: { bucket: "my-bucket" },
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    });

    const dto = StorageBindingResponseMapper.fromDomain(binding);

    expect(dto.id).toBe("01900000-0000-7000-8000-000000000001");
    expect(dto.name).toBe("gcs-prod");
    expect(dto.adapterType).toBe("gcs");
    expect(dto.config).toEqual({ bucket: "my-bucket" });
    expect(dto.createdAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("does not expose any credential field on the DTO", () => {
    const binding = StorageBinding.fromProps({
      id: "01900000-0000-7000-8000-000000000002",
      name: "gcs-staging",
      adapterType: "gcs",
      config: { bucket: "staging-bucket" },
      createdAt: new Date("2026-06-01T00:00:00Z"),
      updatedAt: new Date("2026-06-01T00:00:00Z"),
    });

    const dto = StorageBindingResponseMapper.fromDomain(binding);

    expect("encryptedCredsPresent" in dto).toBe(false);
    expect("encryptedCreds" in dto).toBe(false);
  });
});
