import type { ListAuditQueryDTO } from "@shared/backend-api";
import { useQuery } from "@tanstack/react-query";
import { useLafkenClient } from "@lafken/react";

import { auditKeys } from "@/features/audit/keys";

export function useAuditEntries(q: Partial<ListAuditQueryDTO> = {}) {
  const c = useLafkenClient();
  return useQuery({
    queryKey: auditKeys.list(q),
    queryFn: () => c.audit.list(q),
  });
}
