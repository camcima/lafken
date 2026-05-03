import type { ListQuarantineQuery } from "@/services/QuarantineService";

export const quarantineKeys = {
  all: ["quarantine"] as const,
  lists: () => [...quarantineKeys.all, "list"] as const,
  list: (q: ListQuarantineQuery) => [...quarantineKeys.lists(), q] as const,
};
