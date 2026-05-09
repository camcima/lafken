import { useLafkenClient } from "@lafken/react";
import type { ListQuarantineQueryDTO } from "@shared/backend-api";
import { useQuery } from "@tanstack/react-query";

import { quarantineKeys } from "@/features/quarantine/keys";

export function useQuarantine(q: Partial<ListQuarantineQueryDTO> = {}) {
  const client = useLafkenClient();
  return useQuery({
    queryKey: quarantineKeys.list(q),
    queryFn: () => client.quarantine.list(q),
  });
}
