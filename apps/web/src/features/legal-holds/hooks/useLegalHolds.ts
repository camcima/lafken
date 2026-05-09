import { useLafkenClient } from "@lafken/react";
import { useQuery } from "@tanstack/react-query";

import { legalHoldsKeys } from "@/features/legal-holds/keys";
import type { IListLegalHoldsQuery } from "@/features/legal-holds/keys";

export function useLegalHolds(q: IListLegalHoldsQuery = {}) {
  const client = useLafkenClient();
  return useQuery({
    queryKey: legalHoldsKeys.list(q),
    queryFn: () => client.legalHolds.list(q),
  });
}

export function useLegalHold(id: string) {
  const client = useLafkenClient();
  return useQuery({
    queryKey: legalHoldsKeys.detail(id),
    queryFn: () => client.legalHolds.get(id),
    enabled: Boolean(id),
  });
}
