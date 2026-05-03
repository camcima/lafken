import { Injectable } from "@nestjs/common";

import { UnitOfWorkPort } from "@/shared/application/unit-of-work.port";

import { DatabaseAsyncLocalStorage } from "./database-async-local-storage";
import { DatabaseClient } from "./database-client";

@Injectable()
export class DatabaseUnitOfWork implements UnitOfWorkPort {
  constructor(
    private readonly databaseAsyncLocalStorage: DatabaseAsyncLocalStorage,

    private readonly dbClient: DatabaseClient,
  ) {}

  /**
   * Will encapsulate the `fn` function in a database transaction that uses
   * the isolation level "READ COMMITTED".
   * If there is a active transaction, ie. if this unit of work is nested, it
   * will not create a new transaction, but will use the existing one.
   */
  execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentTransaction = this.databaseAsyncLocalStorage.als.getStore()?.databaseTransaction;
    if (currentTransaction) {
      return fn();
    }

    return this.dbClient.connection
      .transaction()
      .setIsolationLevel("read committed")
      .execute(async (currentTransaction) => {
        return this.databaseAsyncLocalStorage.als.run(
          {
            databaseTransaction: currentTransaction,
          },
          async () => {
            return fn();
          },
        );
      });
  }
}
