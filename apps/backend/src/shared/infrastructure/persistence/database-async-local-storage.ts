import { AsyncLocalStorage } from "node:async_hooks";

import { Transaction } from "kysely";

export class DatabaseAsyncLocalStorage {
  constructor(
    public readonly als: AsyncLocalStorage<{
      databaseTransaction: Transaction<any> | undefined;
    }>,
  ) {}

  /**
   * Returns the active Kysely transaction handle if one is bound to the
   * current async context, otherwise undefined. Repositories use this to
   * opt into the transaction owned by the surrounding UnitOfWork.
   */
  currentTransaction(): Transaction<any> | undefined {
    return this.als.getStore()?.databaseTransaction;
  }
}
