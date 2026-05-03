import { AsyncLocalStorage } from "node:async_hooks";

import { Module, OnModuleDestroy } from "@nestjs/common";

import { AppLoggerPort } from "@/shared/application/app-logger.port";

import { environmentConfiguration } from "../environment.configuration";
import { LoggerModule } from "../logger/logger.module";
import { DatabaseAsyncLocalStorage } from "./database-async-local-storage";
import { DatabaseClient } from "./database-client";
import { DatabaseLogger } from "./database-logger";
import { DatabaseUnitOfWork } from "./database-unit-of-work";

@Module({
  imports: [LoggerModule],
  providers: [
    {
      provide: DatabaseClient,
      inject: [AppLoggerPort],
      useFactory: async (appLogger: AppLoggerPort) => {
        appLogger.setContext(DatabaseClient.name);

        const dbClient = await DatabaseClient.init({
          waitUntilConnected: false, // we don't need to wait otherwise the bootstrapping time could be too long
          logger: (logEvent) => {
            const dbLogger = new DatabaseLogger(appLogger);
            dbLogger.logQuery(logEvent.query.sql, logEvent.query.parameters);
          },
          connectionParams: {
            host: environmentConfiguration.DB_HOST,
            user: environmentConfiguration.DB_USER,
            password: environmentConfiguration.DB_PASSWORD,
            port: environmentConfiguration.DB_PORT,
            database: environmentConfiguration.DB_NAME,
          },
          poolConfig: {
            ssl: environmentConfiguration.DB_SSL,
            // Critical pool settings
            min: environmentConfiguration.DB_POOL_MIN,
            max: environmentConfiguration.DB_POOL_MAX,
            idleTimeoutMillis: environmentConfiguration.DB_POOL_IDLE_TIMEOUT_MS,
            connectionTimeoutMillis: environmentConfiguration.DB_POOL_CONNECTION_TIMEOUT_MS,
            // Important for preventing hanging connections
            statement_timeout: environmentConfiguration.DB_STATEMENT_TIMEOUT_MS,
            query_timeout: environmentConfiguration.DB_QUERY_TIMEOUT_MS,
            idle_in_transaction_session_timeout: environmentConfiguration.DB_IDLE_IN_TX_TIMEOUT_MS,
            // Keep-alive to detect dead connections
            keepAlive: true,
            keepAliveInitialDelayMillis: 10_000,
          },
        });
        return dbClient;
      },
    },

    {
      provide: DatabaseUnitOfWork,
      useClass: DatabaseUnitOfWork,
    },

    {
      provide: DatabaseAsyncLocalStorage,
      useFactory: () => new DatabaseAsyncLocalStorage(new AsyncLocalStorage()),
    },
  ],
  exports: [DatabaseClient, DatabaseUnitOfWork, DatabaseAsyncLocalStorage],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(private readonly databaseClient: DatabaseClient) {}

  async onModuleDestroy() {
    await this.databaseClient.closeConnection();
  }
}
