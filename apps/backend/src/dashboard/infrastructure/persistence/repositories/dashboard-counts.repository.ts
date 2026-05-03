import { Injectable } from "@nestjs/common";

import { DashboardCountsRepositoryPort } from "@/dashboard/domain/repositories/dashboard-counts.repository.port";
import type { IDashboardCounts } from "@/dashboard/domain/types/dashboard-counts.types";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

@Injectable()
export class DashboardCountsRepository implements DashboardCountsRepositoryPort {
  constructor(private readonly db: DatabaseClient) {}

  async read(): Promise<IDashboardCounts> {
    const [
      totalAssetsRow,
      inFlightRow,
      queueDepthRow,
      quarantineRow,
      legalHoldsRow,
      failedProcessingRow,
    ] = await Promise.all([
      this.db.connection
        .selectFrom("assets")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .executeTakeFirstOrThrow(),

      this.db.connection
        .selectFrom("assets")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("state", "in", ["uploaded", "processing"])
        .executeTakeFirstOrThrow(),

      this.db.connection
        .selectFrom("processing_jobs")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("state", "in", ["claimed", "released"])
        .executeTakeFirstOrThrow(),

      this.db.connection
        .selectFrom("assets")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("state", "in", ["quarantined_virus", "quarantined_moderation"])
        .executeTakeFirstOrThrow(),

      this.db.connection
        .selectFrom("legal_holds")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("active", "=", true)
        .executeTakeFirstOrThrow(),

      this.db.connection
        .selectFrom("assets")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("state", "=", "processing_failed")
        .executeTakeFirstOrThrow(),
    ]);

    return {
      totalAssets: Number(totalAssetsRow.count),
      inFlight: Number(inFlightRow.count),
      queueDepth: Number(queueDepthRow.count),
      quarantine: Number(quarantineRow.count),
      legalHolds: Number(legalHoldsRow.count),
      failedProcessing: Number(failedProcessingRow.count),
    };
  }
}
