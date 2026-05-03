import type { IDashboardCounts } from "@/dashboard/domain/types/dashboard-counts.types";

export abstract class DashboardCountsRepositoryPort {
  abstract read(): Promise<IDashboardCounts>;
}
