import { useLafkenClient } from "@lafken/react";
import type { ListAuditQueryDTO } from "@shared/backend-api";
import { useQuery } from "@tanstack/react-query";

import { auditKeys } from "@/features/audit/keys";

export function useAuditEntries(q: Partial<ListAuditQueryDTO> = {}) {
  const client = useLafkenClient();
  return useQuery({
    queryKey: auditKeys.list(q),
    queryFn: () => client.audit.list(q),
  });
}
