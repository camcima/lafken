import { describe, expect, it } from "vitest";

import { RefreshUploadUrlUseCase } from "@/assets/application/use-cases/refresh-upload-url.use-case";
import { UploadIntentAlreadyConsumedError } from "@/assets/domain/errors/upload-intent-already-consumed.error";
import { UploadIntentExpiredError } from "@/assets/domain/errors/upload-intent-expired.error";
import { UploadIntentNotFoundError } from "@/assets/domain/errors/upload-intent-not-found.error";

import { InMemoryAssetQueryRepository } from "../__fakes__/in-memory-asset-query.repository";
import {
  buildAuditWriteRepoStub,
  buildBindingRepoStub,
  buildIntentRepoStub,
  buildIssuerStub,
} from "./helpers/refresh-upload-url-stubs";

describe("RefreshUploadUrlUseCase", () => {
  it("issues a fresh URL and audit-logs url_refreshed", async () => {
    const intentRepo = buildIntentRepoStub({
      protocol: "simple",
      consumedAt: null,
      expiredAt: null,
    });
    const issuer = buildIssuerStub({ simpleUrl: "https://gcs/new" });
    const audit = buildAuditWriteRepoStub();
    const useCase = new RefreshUploadUrlUseCase(
      intentRepo,
      buildBindingRepoStub(),
      issuer,
      audit,
      new InMemoryAssetQueryRepository(),
    );

    const result = await useCase.execute({
      publicId: "pid-1",
      requestedBy: "ops@latam.com",
    });

    expect(result.uploadUrl).toBe("https://gcs/new");
    expect(result.uploadHeaders["Content-Type"]).toBe("image/jpeg");
    expect(audit.calls).toEqual([
      expect.objectContaining({
        entityType: "upload_intent",
        entityId: "pid-1",
        action: "url_refreshed",
      }),
    ]);
    expect(intentRepo.refreshUploadUrlCalls).toHaveLength(1);
  });

  it("throws UploadIntentNotFoundError when the intent does not exist", async () => {
    const useCase = new RefreshUploadUrlUseCase(
      buildIntentRepoStub({ missing: true }),
      buildBindingRepoStub(),
      buildIssuerStub(),
      buildAuditWriteRepoStub(),
      new InMemoryAssetQueryRepository(),
    );
    await expect(useCase.execute({ publicId: "missing", requestedBy: "u" })).rejects.toBeInstanceOf(
      UploadIntentNotFoundError,
    );
  });

  it("throws UploadIntentAlreadyConsumedError when consumed", async () => {
    const useCase = new RefreshUploadUrlUseCase(
      buildIntentRepoStub({ consumedAt: new Date() }),
      buildBindingRepoStub(),
      buildIssuerStub(),
      buildAuditWriteRepoStub(),
      new InMemoryAssetQueryRepository(),
    );
    await expect(useCase.execute({ publicId: "pid-1", requestedBy: "u" })).rejects.toBeInstanceOf(
      UploadIntentAlreadyConsumedError,
    );
  });

  it("throws UploadIntentExpiredError when swept", async () => {
    const useCase = new RefreshUploadUrlUseCase(
      buildIntentRepoStub({ expiredAt: new Date() }),
      buildBindingRepoStub(),
      buildIssuerStub(),
      buildAuditWriteRepoStub(),
      new InMemoryAssetQueryRepository(),
    );
    await expect(useCase.execute({ publicId: "pid-1", requestedBy: "u" })).rejects.toBeInstanceOf(
      UploadIntentExpiredError,
    );
  });
});
