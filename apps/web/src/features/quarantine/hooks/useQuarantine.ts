import { useQuery } from "@tanstack/react-query";

import { quarantineKeys } from "@/features/quarantine/keys";
import { quarantineService } from "@/services";
import type { ListQuarantineQuery } from "@/services/QuarantineService";

export function useQuarantine(q: ListQuarantineQuery = {}) {
  return useQuery({
    queryKey: quarantineKeys.list(q),
    queryFn: () => quarantineService.list(q),
  });
}
