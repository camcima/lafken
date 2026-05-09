export interface IListLegalHoldsQuery {
  page?: number;
  limit?: number;
}

export const legalHoldsKeys = {
  all: ["legal-holds"] as const,
  lists: () => [...legalHoldsKeys.all, "list"] as const,
  list: (q: IListLegalHoldsQuery) => [...legalHoldsKeys.lists(), q] as const,
  details: () => [...legalHoldsKeys.all, "detail"] as const,
  detail: (id: string) => [...legalHoldsKeys.details(), id] as const,
};
