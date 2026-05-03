import { beforeEach, describe, expect, it } from "vitest";

import { ListIntegrationsUseCase } from "@/system/application/use-cases/list-integrations.use-case";
import type { IIntegrationStatus } from "@/system/domain/services/integration-status-reader.service.port";

import { StaticIntegrationStatusReaderAdapter } from "../__fakes__/static-integration-status-reader.adapter";

describe("ListIntegrationsUseCase", () => {
  let integrationReader: StaticIntegrationStatusReaderAdapter;
  let useCase: ListIntegrationsUseCase;

  beforeEach(() => {
    integrationReader = new StaticIntegrationStatusReaderAdapter();
    useCase = new ListIntegrationsUseCase(integrationReader);
  });

  it("returns an empty list when the reader has no statuses", async () => {
    const result = await useCase.execute();
    expect(result).toEqual([]);
  });

  it("returns the integration statuses from the reader", async () => {
    const statuses: IIntegrationStatus[] = [
      { port: "storage", adapter: "not_configured", status: "not_configured", detail: null },
    ];
    integrationReader.seed(statuses);

    const result = await useCase.execute();
    expect(result).toHaveLength(1);
    expect(result[0].port).toBe("storage");
    expect(result[0].status).toBe("not_configured");
  });
});
