import type { ListAuditQuery } from "@/services/AuditService";

export const auditKeys = {
  all: ["audit"] as const,
  lists: () => [...auditKeys.all, "list"] as const,
  list: (q: ListAuditQuery) => [...auditKeys.lists(), q] as const,
};
