import type { ListAuditQueryDTO } from "@shared/backend-api";
import { useQuery } from "@tanstack/react-query";

import { auditKeys } from "@/features/audit/keys";
import { auditService } from "@/services";

export function useAuditEntries(q: Partial<ListAuditQueryDTO> = {}) {
  return useQuery({
    queryKey: auditKeys.list(q),
    queryFn: () => auditService.list(q),
  });
}
