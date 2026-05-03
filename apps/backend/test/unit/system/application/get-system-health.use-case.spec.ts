import { beforeEach, describe, expect, it } from "vitest";

import { GetSystemHealthUseCase } from "@/system/application/use-cases/get-system-health.use-case";
import type { ISystemHealthSnapshot } from "@/system/domain/services/system-health-reader.service.port";

import { StaticSystemHealthReaderAdapter } from "../__fakes__/static-system-health-reader.adapter";

describe("GetSystemHealthUseCase", () => {
  let healthReader: StaticSystemHealthReaderAdapter;
  let useCase: GetSystemHealthUseCase;

  beforeEach(() => {
    healthReader = new StaticSystemHealthReaderAdapter();
    useCase = new GetSystemHealthUseCase(healthReader);
  });

  it("returns the health snapshot from the reader", async () => {
    const result = await useCase.execute();
    expect(result.overall).toBe("ok");
    expect(result.indicators).toHaveLength(1);
    expect(result.indicators[0].name).toBe("database");
  });

  it("returns a failing snapshot when the reader reports failing", async () => {
    const failingSnapshot: ISystemHealthSnapshot = {
      overall: "failing",
      indicators: [{ name: "database", status: "failing", detail: "database is unreachable" }],
      integrations: [],
    };
    healthReader.seed(failingSnapshot);

    const result = await useCase.execute();
    expect(result.overall).toBe("failing");
    expect(result.indicators[0].status).toBe("failing");
    expect(result.indicators[0].detail).toBe("database is unreachable");
  });
});
