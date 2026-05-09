import { useQuery } from "@tanstack/react-query";
import { useLafkenClient } from "@lafken/react";

import { dashboardKeys } from "@/features/dashboard/keys";

export function useDashboardOverview() {
  const c = useLafkenClient();
  return useQuery({
    queryKey: dashboardKeys.overview(),
    queryFn: () => c.dashboard.getOverview(),
  });
}
