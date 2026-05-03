import type { ListQuarantineQueryDTO } from "@shared/backend-api";
import { useQuery } from "@tanstack/react-query";

import { quarantineKeys } from "@/features/quarantine/keys";
import { quarantineService } from "@/services";

export function useQuarantine(q: Partial<ListQuarantineQueryDTO> = {}) {
  return useQuery({
    queryKey: quarantineKeys.list(q),
    queryFn: () => quarantineService.list(q),
  });
}
