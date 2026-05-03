import { describe, expect, it } from "vitest";

import { StorageBinding } from "@/system/domain/entities/storage-binding.entity";

import { StorageBindingResponseMapper } from "./storage-binding.response-mapper";

describe("StorageBindingResponseMapper", () => {
  it("maps a storage binding without encrypted creds to encryptedCredsPresent=false", () => {
    const binding = StorageBinding.fromProps({
      id: 1n,
      name: "default",
      adapterType: "local",
      config: { path: "/tmp" },
      encryptedCreds: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    });

    const dto = StorageBindingResponseMapper.fromDomain(binding);

    expect(dto.name).toBe("default");
    expect(dto.adapterType).toBe("local");
    expect(dto.config).toEqual({ path: "/tmp" });
    expect(dto.encryptedCredsPresent).toBe(false);
    expect(dto.createdAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("maps a storage binding with encrypted creds to encryptedCredsPresent=true without exposing the blob", () => {
    const binding = StorageBinding.fromProps({
      id: 2n,
      name: "gcs-prod",
      adapterType: "gcs",
      config: { bucket: "my-bucket" },
      encryptedCreds: Buffer.from("secret"),
      createdAt: new Date("2026-02-01T00:00:00Z"),
      updatedAt: new Date("2026-02-01T00:00:00Z"),
    });

    const dto = StorageBindingResponseMapper.fromDomain(binding);

    expect(dto.encryptedCredsPresent).toBe(true);
    expect("encryptedCreds" in dto).toBe(false);
  });
});
