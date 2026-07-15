import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it } from "vitest";

import { ConfirmUploadRequestDTO } from "../confirm-upload-request.dto";

describe("ConfirmUploadRequestDTO shared metadata", () => {
  it("accepts a body with externalRef, note, and tags alongside dimensions", async () => {
    const dto = plainToInstance(ConfirmUploadRequestDTO, {
      width: 100,
      height: 50,
      externalRefType: "work_order",
      externalRefId: "wo-2026-018",
      note: "left wing panel",
      tags: ["inspection", "wing"],
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it("accepts an empty body (every field is optional)", async () => {
    const dto = plainToInstance(ConfirmUploadRequestDTO, {});
    expect(await validate(dto)).toHaveLength(0);
  });

  it("rejects non-string tag entries", async () => {
    const dto = plainToInstance(ConfirmUploadRequestDTO, { tags: [42] });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it("rejects more than 32 tags", async () => {
    const dto = plainToInstance(ConfirmUploadRequestDTO, {
      tags: Array.from({ length: 33 }, (_, i) => `tag-${i}`),
    });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it("rejects a tag longer than 64 characters", async () => {
    const dto = plainToInstance(ConfirmUploadRequestDTO, { tags: ["x".repeat(65)] });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it("rejects a non-string note", async () => {
    const dto = plainToInstance(ConfirmUploadRequestDTO, { note: 123 });
    expect(await validate(dto)).not.toHaveLength(0);
  });
});
