import { Injectable } from "@nestjs/common";

import { DatabaseAsyncLocalStorage } from "./database-async-local-storage";
import { DatabaseClient } from "./database-client";

@Injectable()
export abstract class BaseRepository {
  constructor(
    protected readonly databaseAsyncLocalStorage: DatabaseAsyncLocalStorage,

    protected readonly dbClient: DatabaseClient,
  ) {}

  /**
   * A database transaction if any, or undefined if no transaction is in progress.
   * To be used when one needs to reuse the same database transaction for multiple
   * operations across different repositories implementations.
   */
  protected get currentTransaction() {
    return this.databaseAsyncLocalStorage.als.getStore()?.databaseTransaction;
  }
}
