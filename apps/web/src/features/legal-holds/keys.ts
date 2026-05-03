import type { ListLegalHoldsQuery } from "@/services/LegalHoldsService";

export const legalHoldsKeys = {
  all: ["legal-holds"] as const,
  lists: () => [...legalHoldsKeys.all, "list"] as const,
  list: (q: ListLegalHoldsQuery) => [...legalHoldsKeys.lists(), q] as const,
  details: () => [...legalHoldsKeys.all, "detail"] as const,
  detail: (id: string) => [...legalHoldsKeys.details(), id] as const,
};
