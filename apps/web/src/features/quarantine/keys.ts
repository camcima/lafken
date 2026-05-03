import type { ListQuarantineQueryDTO } from "@shared/backend-api";

export const quarantineKeys = {
  all: ["quarantine"] as const,
  lists: () => [...quarantineKeys.all, "list"] as const,
  list: (q: Partial<ListQuarantineQueryDTO>) => [...quarantineKeys.lists(), q] as const,
};
