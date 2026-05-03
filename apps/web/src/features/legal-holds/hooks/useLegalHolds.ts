import { useQuery } from "@tanstack/react-query";

import { legalHoldsKeys } from "@/features/legal-holds/keys";
import { legalHoldsService } from "@/services";
import type { ListLegalHoldsQuery } from "@/services/LegalHoldsService";

export function useLegalHolds(q: ListLegalHoldsQuery = {}) {
  return useQuery({
    queryKey: legalHoldsKeys.list(q),
    queryFn: () => legalHoldsService.list(q),
  });
}

export function useLegalHold(id: string) {
  return useQuery({
    queryKey: legalHoldsKeys.detail(id),
    queryFn: () => legalHoldsService.getById(id),
    enabled: Boolean(id),
  });
}
