import { plainToInstance } from "class-transformer";
import type { ValidationError } from "class-validator";
import { validate } from "class-validator";
import { describe, expect, it } from "vitest";

import {
  NAMESPACE_DESCRIPTION_MAX_LENGTH,
  NAMESPACE_DISPLAY_NAME_MAX_LENGTH,
  NAMESPACE_SLUG_MAX_LENGTH,
  POLICY_MAX_FILE_SIZE_BYTES,
  POLICY_MAX_RETENTION_DAYS,
  POLICY_MAX_SIGNED_URL_BUCKET_SIZE,
  POLICY_MAX_TTL_SECONDS,
} from "../../../shared/validation-constants";
import { CreateNamespaceRequestDTO } from "../create-namespace-request.dto";

// This suite proves the DTO's decorators are wired to the *same* shared
// constants the web forms consume — not to independent literals that happen
// to match today. Each bound is derived from the imported constant, so a
// future edit to `validation-constants.ts` that isn't mirrored by the
// decorator (or vice versa) makes these assertions fail.

interface IValidPayloadOverrides {
  slug?: string;
  displayName?: string;
  description?: string | null;
  policy?: Partial<CreateNamespaceRequestDTO["policy"]>;
}

function validPayload(overrides: IValidPayloadOverrides = {}): Record<string, unknown> {
  return {
    slug: overrides.slug ?? "aircraft-photos",
    displayName: overrides.displayName ?? "Aircraft photos",
    description: overrides.description ?? null,
    storageBindingId: "01900000-0000-7000-8000-000000000001",
    policy: {
      retentionDays: null,
      retentionMode: "none",
      maxFileSizeBytes: 100,
      allowedMimeTypes: ["image/jpeg"],
      virusScanRequired: true,
      contentModeration: null,
      requiredMetadataSchema: null,
      immutable: false,
      servingMode: "public",
      signedUrlTtlSeconds: null,
      signedUrlBucketSize: null,
      retryConfig: null,
      ...overrides.policy,
    },
  };
}

function findError(errors: ValidationError[], property: string): ValidationError | undefined {
  return errors.find((e) => e.property === property);
}

function findPolicyError(errors: ValidationError[], property: string): ValidationError | undefined {
  const policyError = findError(errors, "policy");
  return policyError?.children?.find((e) => e.property === property);
}

async function validateDto(payload: Record<string, unknown>): Promise<ValidationError[]> {
  const dto = plainToInstance(CreateNamespaceRequestDTO, payload);
  return validate(dto);
}

describe("CreateNamespaceRequestDTO — slug bound matches NAMESPACE_SLUG_MAX_LENGTH", () => {
  it(`accepts a slug of exactly ${String(NAMESPACE_SLUG_MAX_LENGTH)} characters`, async () => {
    const slug = "a".repeat(NAMESPACE_SLUG_MAX_LENGTH);
    const errors = await validateDto(validPayload({ slug }));
    expect(findError(errors, "slug")).toBeUndefined();
  });

  it(`rejects a slug of ${String(NAMESPACE_SLUG_MAX_LENGTH + 1)} characters`, async () => {
    const slug = "a".repeat(NAMESPACE_SLUG_MAX_LENGTH + 1);
    const errors = await validateDto(validPayload({ slug }));
    expect(findError(errors, "slug")).toBeDefined();
  });
});

describe("CreateNamespaceRequestDTO — displayName bound matches NAMESPACE_DISPLAY_NAME_MAX_LENGTH", () => {
  it(`accepts a displayName of exactly ${String(NAMESPACE_DISPLAY_NAME_MAX_LENGTH)} characters`, async () => {
    const displayName = "d".repeat(NAMESPACE_DISPLAY_NAME_MAX_LENGTH);
    const errors = await validateDto(validPayload({ displayName }));
    expect(findError(errors, "displayName")).toBeUndefined();
  });

  it(`rejects a displayName of ${String(NAMESPACE_DISPLAY_NAME_MAX_LENGTH + 1)} characters`, async () => {
    const displayName = "d".repeat(NAMESPACE_DISPLAY_NAME_MAX_LENGTH + 1);
    const errors = await validateDto(validPayload({ displayName }));
    expect(findError(errors, "displayName")).toBeDefined();
  });
});

describe("CreateNamespaceRequestDTO — description bound matches NAMESPACE_DESCRIPTION_MAX_LENGTH", () => {
  it(`accepts a description of exactly ${String(NAMESPACE_DESCRIPTION_MAX_LENGTH)} characters`, async () => {
    const description = "d".repeat(NAMESPACE_DESCRIPTION_MAX_LENGTH);
    const errors = await validateDto(validPayload({ description }));
    expect(findError(errors, "description")).toBeUndefined();
  });

  it(`rejects a description of ${String(NAMESPACE_DESCRIPTION_MAX_LENGTH + 1)} characters`, async () => {
    const description = "d".repeat(NAMESPACE_DESCRIPTION_MAX_LENGTH + 1);
    const errors = await validateDto(validPayload({ description }));
    expect(findError(errors, "description")).toBeDefined();
  });
});

describe("CreateNamespacePolicyDTO — maxFileSizeBytes bound matches POLICY_MAX_FILE_SIZE_BYTES", () => {
  it(`accepts exactly ${String(POLICY_MAX_FILE_SIZE_BYTES)} bytes`, async () => {
    const errors = await validateDto(
      validPayload({ policy: { maxFileSizeBytes: POLICY_MAX_FILE_SIZE_BYTES } }),
    );
    expect(findPolicyError(errors, "maxFileSizeBytes")).toBeUndefined();
  });

  it(`rejects ${String(POLICY_MAX_FILE_SIZE_BYTES + 1)} bytes`, async () => {
    const errors = await validateDto(
      validPayload({ policy: { maxFileSizeBytes: POLICY_MAX_FILE_SIZE_BYTES + 1 } }),
    );
    expect(findPolicyError(errors, "maxFileSizeBytes")).toBeDefined();
  });
});

describe("CreateNamespacePolicyDTO — retentionDays bound matches POLICY_MAX_RETENTION_DAYS", () => {
  it(`accepts exactly ${String(POLICY_MAX_RETENTION_DAYS)} days`, async () => {
    const errors = await validateDto(
      validPayload({ policy: { retentionDays: POLICY_MAX_RETENTION_DAYS } }),
    );
    expect(findPolicyError(errors, "retentionDays")).toBeUndefined();
  });

  it(`rejects ${String(POLICY_MAX_RETENTION_DAYS + 1)} days`, async () => {
    const errors = await validateDto(
      validPayload({ policy: { retentionDays: POLICY_MAX_RETENTION_DAYS + 1 } }),
    );
    expect(findPolicyError(errors, "retentionDays")).toBeDefined();
  });
});

describe("CreateNamespacePolicyDTO — signedUrlTtlSeconds bound matches POLICY_MAX_TTL_SECONDS", () => {
  it(`accepts exactly ${String(POLICY_MAX_TTL_SECONDS)} seconds`, async () => {
    const errors = await validateDto(
      validPayload({ policy: { signedUrlTtlSeconds: POLICY_MAX_TTL_SECONDS } }),
    );
    expect(findPolicyError(errors, "signedUrlTtlSeconds")).toBeUndefined();
  });

  it(`rejects ${String(POLICY_MAX_TTL_SECONDS + 1)} seconds`, async () => {
    const errors = await validateDto(
      validPayload({ policy: { signedUrlTtlSeconds: POLICY_MAX_TTL_SECONDS + 1 } }),
    );
    expect(findPolicyError(errors, "signedUrlTtlSeconds")).toBeDefined();
  });
});

describe("CreateNamespacePolicyDTO — signedUrlBucketSize bound matches POLICY_MAX_SIGNED_URL_BUCKET_SIZE", () => {
  it(`accepts exactly ${String(POLICY_MAX_SIGNED_URL_BUCKET_SIZE)}`, async () => {
    const errors = await validateDto(
      validPayload({ policy: { signedUrlBucketSize: POLICY_MAX_SIGNED_URL_BUCKET_SIZE } }),
    );
    expect(findPolicyError(errors, "signedUrlBucketSize")).toBeUndefined();
  });

  it(`rejects ${String(POLICY_MAX_SIGNED_URL_BUCKET_SIZE + 1)}`, async () => {
    const errors = await validateDto(
      validPayload({ policy: { signedUrlBucketSize: POLICY_MAX_SIGNED_URL_BUCKET_SIZE + 1 } }),
    );
    expect(findPolicyError(errors, "signedUrlBucketSize")).toBeDefined();
  });
});
