import { useQuery } from "@tanstack/react-query";

import { dashboardKeys } from "@/features/dashboard/keys";
import { dashboardService } from "@/services";

export function useDashboardOverview() {
  return useQuery({
    queryKey: dashboardKeys.overview(),
    queryFn: () => dashboardService.getOverview(),
  });
}
