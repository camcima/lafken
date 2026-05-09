import { useLafkenClient } from "@lafken/react";
import { useQuery } from "@tanstack/react-query";

import { dashboardKeys } from "@/features/dashboard/keys";

export function useDashboardOverview() {
  const client = useLafkenClient();
  return useQuery({
    queryKey: dashboardKeys.overview(),
    queryFn: () => client.dashboard.getOverview(),
  });
}
