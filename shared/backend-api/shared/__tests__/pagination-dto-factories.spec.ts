import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it } from "vitest";

import { makePaginatedRequestInputDto } from "../pagination-dto-factories";

class TestQueryDTO extends makePaginatedRequestInputDto() {}

describe("makePaginatedRequestInputDto limit bounds", () => {
  it("defaults limit to 20 and validates clean", async () => {
    const dto = plainToInstance(TestQueryDTO, {});
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.limit).toBe(20);
  });

  it("accepts limit=1 (the floor)", async () => {
    const dto = plainToInstance(TestQueryDTO, { limit: "1" });
    expect(await validate(dto)).toHaveLength(0);
  });

  it("accepts limit=100 (the cap)", async () => {
    const dto = plainToInstance(TestQueryDTO, { limit: "100" });
    expect(await validate(dto)).toHaveLength(0);
  });

  it("rejects limit=0", async () => {
    const dto = plainToInstance(TestQueryDTO, { limit: "0" });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it("rejects limit=101", async () => {
    const dto = plainToInstance(TestQueryDTO, { limit: "101" });
    expect(await validate(dto)).not.toHaveLength(0);
  });
});
