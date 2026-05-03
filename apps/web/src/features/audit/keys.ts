import type { ListAuditQueryDTO } from "@shared/backend-api";

export const auditKeys = {
  all: ["audit"] as const,
  lists: () => [...auditKeys.all, "list"] as const,
  list: (q: Partial<ListAuditQueryDTO>) => [...auditKeys.lists(), q] as const,
};
