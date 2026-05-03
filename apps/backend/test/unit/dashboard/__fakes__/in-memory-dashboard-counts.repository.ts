import { DashboardCountsRepositoryPort } from "@/dashboard/domain/repositories/dashboard-counts.repository.port";
import type { IDashboardCounts } from "@/dashboard/domain/types/dashboard-counts.types";

const DEFAULT_COUNTS: IDashboardCounts = {
  totalAssets: 0,
  inFlight: 0,
  queueDepth: 0,
  quarantine: 0,
  legalHolds: 0,
  failedProcessing: 0,
};

export class InMemoryDashboardCountsRepository extends DashboardCountsRepositoryPort {
  private counts: IDashboardCounts = { ...DEFAULT_COUNTS };

  seed(counts: Partial<IDashboardCounts>): void {
    this.counts = { ...DEFAULT_COUNTS, ...counts };
  }

  read(): Promise<IDashboardCounts> {
    return Promise.resolve({ ...this.counts });
  }
}
