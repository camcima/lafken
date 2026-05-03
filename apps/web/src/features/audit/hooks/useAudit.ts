import { useQuery } from "@tanstack/react-query";

import { auditKeys } from "@/features/audit/keys";
import { auditService } from "@/services";
import type { ListAuditQuery } from "@/services/AuditService";

export function useAuditEntries(q: ListAuditQuery = {}) {
  return useQuery({
    queryKey: auditKeys.list(q),
    queryFn: () => auditService.list(q),
  });
}
