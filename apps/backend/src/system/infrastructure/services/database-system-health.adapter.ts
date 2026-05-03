import { Injectable } from "@nestjs/common";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";
import type { IIntegrationStatus } from "@/system/domain/services/integration-status-reader.service.port";
import { IntegrationStatusReader } from "@/system/domain/services/integration-status-reader.service.port";
import type {
  HealthStatusValue,
  ISystemHealthIndicator,
  ISystemHealthSnapshot,
} from "@/system/domain/services/system-health-reader.service.port";
import { SystemHealthReader } from "@/system/domain/services/system-health-reader.service.port";

@Injectable()
export class DatabaseSystemHealthAdapter extends SystemHealthReader {
  constructor(
    private readonly db: DatabaseClient,
    private readonly integrationReader: IntegrationStatusReader,
  ) {
    super();
  }

  async read(): Promise<ISystemHealthSnapshot> {
    const dbProbe = await this.db.isConnected({ retryAttempts: 1, retryDelayMs: 0 });

    const dbIndicator: ISystemHealthIndicator = {
      name: "database",
      status: dbProbe.ok ? "ok" : "failing",
      detail: dbProbe.ok ? null : "database is unreachable",
    };

    const integrations: IIntegrationStatus[] = await this.integrationReader.read();

    const overall: HealthStatusValue = (() => {
      if (dbIndicator.status === "failing") return "failing";
      // No degraded indicators in Slice 0
      return "ok";
    })();

    return {
      overall,
      indicators: [dbIndicator],
      integrations,
    };
  }
}
