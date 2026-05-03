import { DynamicModule, Module } from "@nestjs/common";
import { mock } from "vitest-mock-extended";

import { DatabaseAsyncLocalStorage } from "../../src/shared/infrastructure/persistence/database-async-local-storage";
import { DatabaseClient } from "../../src/shared/infrastructure/persistence/database-client";
import { DatabaseUnitOfWork } from "../../src/shared/infrastructure/persistence/database-unit-of-work";

@Module({
  providers: [
    {
      provide: DatabaseClient,
      useFactory: () => {
        return mock<DatabaseClient>();
      },
    },
    {
      provide: DatabaseUnitOfWork,
      useFactory: () => {
        return mock<DatabaseUnitOfWork>();
      },
    },
    {
      provide: DatabaseAsyncLocalStorage,
      useFactory: () => {
        return mock<DatabaseAsyncLocalStorage>();
      },
    },
  ],
  exports: [DatabaseClient, DatabaseUnitOfWork, DatabaseAsyncLocalStorage],
})
export class NoopDatabaseModuleMock {
  /**
   * Register a module with a no-op transaction adapter so that the transactions
   * won't be started but all the transaction host will be available to be injected.
   */
  static registerNoopTransaction(): DynamicModule {
    return {
      module: NoopDatabaseModuleMock,
      imports: [],
    };
  }
}
