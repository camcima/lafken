import { describe, expect, it } from "vitest";

import { gcsBindingConfigSchema } from "@/system/application/gcs-binding-config.schema";

describe("gcsBindingConfigSchema", () => {
  it("accepts a minimal valid config (bucket + projectId, no prefix)", () => {
    const result = gcsBindingConfigSchema.safeParse({
      bucket: "my-bucket",
      projectId: "my-project",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a config with a prefix", () => {
    const result = gcsBindingConfigSchema.safeParse({
      bucket: "my-bucket",
      projectId: "my-project",
      prefix: "uploads/",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing bucket", () => {
    const result = gcsBindingConfigSchema.safeParse({
      projectId: "my-project",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing projectId", () => {
    const result = gcsBindingConfigSchema.safeParse({
      bucket: "my-bucket",
    });
    expect(result.success).toBe(false);
  });

  it("rejects bucket too short (< 3 chars)", () => {
    const result = gcsBindingConfigSchema.safeParse({
      bucket: "ab",
      projectId: "my-project",
    });
    expect(result.success).toBe(false);
  });

  it("rejects bucket too long (> 63 chars)", () => {
    const result = gcsBindingConfigSchema.safeParse({
      bucket: "a".repeat(64),
      projectId: "my-project",
    });
    expect(result.success).toBe(false);
  });

  it("rejects bucket with uppercase characters", () => {
    const result = gcsBindingConfigSchema.safeParse({
      bucket: "My-Bucket",
      projectId: "my-project",
    });
    expect(result.success).toBe(false);
  });

  it("rejects bucket starting with a hyphen", () => {
    const result = gcsBindingConfigSchema.safeParse({
      bucket: "-my-bucket",
      projectId: "my-project",
    });
    expect(result.success).toBe(false);
  });

  it("rejects bucket ending with a hyphen", () => {
    const result = gcsBindingConfigSchema.safeParse({
      bucket: "my-bucket-",
      projectId: "my-project",
    });
    expect(result.success).toBe(false);
  });

  it("rejects projectId too short (< 6 chars)", () => {
    const result = gcsBindingConfigSchema.safeParse({
      bucket: "my-bucket",
      projectId: "abc",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a 3-char bucket name (minimum valid)", () => {
    const result = gcsBindingConfigSchema.safeParse({
      bucket: "abc",
      projectId: "my-project",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a 63-char bucket name (maximum valid)", () => {
    const result = gcsBindingConfigSchema.safeParse({
      bucket: `a${"b".repeat(61)}c`,
      projectId: "my-project",
    });
    expect(result.success).toBe(true);
  });
});
