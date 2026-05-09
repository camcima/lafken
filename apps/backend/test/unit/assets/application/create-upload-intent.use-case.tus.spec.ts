import { describe, expect, it } from "vitest";

import { CreateUploadIntentUseCase } from "@/assets/application/use-cases/create-upload-intent.use-case";
import { TusNotConfiguredError } from "@/assets/domain/errors/tus-not-configured.error";

import {
  buildBindingRepoStub,
  buildIntentRepoStub,
  buildIssuerStub,
  buildNamespaceRepoStub,
} from "./helpers/create-upload-intent-stubs";

describe("CreateUploadIntentUseCase protocol selection", () => {
  it("defaults to 'simple' and returns the GCS-issued URL", async () => {
    const issuer = buildIssuerStub({ simpleUrl: "https://gcs/upload" });
    const useCase = new CreateUploadIntentUseCase(
      buildNamespaceRepoStub(),
      buildBindingRepoStub(),
      buildIntentRepoStub(),
      issuer,
    );
    const result = await useCase.execute({
      namespaceSlug: "n",
      declaredMimeType: "image/jpeg",
      declaredSizeBytes: BigInt(1),
      createdBy: "u@latam.com",
    });
    expect(result.protocol).toBe("simple");
    expect(result.uploadUrl).toBe("https://gcs/upload");
    expect(issuer.calls[0]?.protocol).toBe("simple");
  });

  it("issues a tus URL when protocol='tus' and tusd is configured", async () => {
    const issuer = buildIssuerStub({ tusUrl: "http://tusd:1080/files/abc" });
    const useCase = new CreateUploadIntentUseCase(
      buildNamespaceRepoStub(),
      buildBindingRepoStub(),
      buildIntentRepoStub(),
      issuer,
    );
    const result = await useCase.execute({
      namespaceSlug: "n",
      declaredMimeType: "image/jpeg",
      declaredSizeBytes: BigInt(1),
      createdBy: "u@latam.com",
      protocol: "tus",
    });
    expect(result.protocol).toBe("tus");
    expect(result.uploadUrl).toBe("http://tusd:1080/files/abc");
  });

  it("propagates TusNotConfiguredError from the issuer", async () => {
    const issuer = buildIssuerStub({ throwTusUnconfigured: true });
    const useCase = new CreateUploadIntentUseCase(
      buildNamespaceRepoStub(),
      buildBindingRepoStub(),
      buildIntentRepoStub(),
      issuer,
    );
    await expect(
      useCase.execute({
        namespaceSlug: "n",
        declaredMimeType: "image/jpeg",
        declaredSizeBytes: BigInt(1),
        createdBy: "u@latam.com",
        protocol: "tus",
      }),
    ).rejects.toBeInstanceOf(TusNotConfiguredError);
  });
});
