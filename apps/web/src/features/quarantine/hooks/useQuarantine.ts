import type { ListQuarantineQueryDTO } from "@shared/backend-api";
import { useQuery } from "@tanstack/react-query";
import { useLafkenClient } from "@lafken/react";

import { quarantineKeys } from "@/features/quarantine/keys";

export function useQuarantine(q: Partial<ListQuarantineQueryDTO> = {}) {
  const c = useLafkenClient();
  return useQuery({
    queryKey: quarantineKeys.list(q),
    queryFn: () => c.quarantine.list(q),
  });
}
