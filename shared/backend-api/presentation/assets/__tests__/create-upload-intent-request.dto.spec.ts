import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it } from "vitest";

import { CreateUploadIntentRequestDTO } from "../create-upload-intent-request.dto";

describe("CreateUploadIntentRequestDTO.protocol", () => {
  it("defaults protocol to undefined when absent", async () => {
    const dto = plainToInstance(CreateUploadIntentRequestDTO, {
      namespaceSlug: "n",
      declaredMimeType: "image/jpeg",
      declaredSizeBytes: 1,
    });
    expect(dto.protocol).toBeUndefined();
    expect(await validate(dto)).toHaveLength(0);
  });

  it("accepts 'simple' and 'tus'", async () => {
    for (const protocol of ["simple", "tus"]) {
      const dto = plainToInstance(CreateUploadIntentRequestDTO, {
        namespaceSlug: "n",
        declaredMimeType: "image/jpeg",
        declaredSizeBytes: 1,
        protocol,
      });
      expect(await validate(dto)).toHaveLength(0);
    }
  });

  it("rejects unknown protocols", async () => {
    const dto = plainToInstance(CreateUploadIntentRequestDTO, {
      namespaceSlug: "n",
      declaredMimeType: "image/jpeg",
      declaredSizeBytes: 1,
      protocol: "foo",
    });
    expect(await validate(dto)).not.toHaveLength(0);
  });
});
