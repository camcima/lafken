import { AsyncLocalStorage } from "node:async_hooks";

import { Transaction } from "kysely";

export class DatabaseAsyncLocalStorage {
  constructor(
    public readonly als: AsyncLocalStorage<{
      databaseTransaction: Transaction<any> | undefined;
    }>,
  ) {}
}
