import { useQuery } from "@tanstack/react-query";
import { useLafkenClient } from "@lafken/react";

import { legalHoldsKeys } from "@/features/legal-holds/keys";
import type { IListLegalHoldsQuery } from "@/features/legal-holds/keys";

export function useLegalHolds(q: IListLegalHoldsQuery = {}) {
  const c = useLafkenClient();
  return useQuery({
    queryKey: legalHoldsKeys.list(q),
    queryFn: () => c.legalHolds.list(q),
  });
}

export function useLegalHold(id: string) {
  const c = useLafkenClient();
  return useQuery({
    queryKey: legalHoldsKeys.detail(id),
    queryFn: () => c.legalHolds.get(id),
    enabled: Boolean(id),
  });
}
