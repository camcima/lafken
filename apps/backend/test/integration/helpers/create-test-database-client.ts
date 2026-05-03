/* eslint-disable no-process-env */
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

const DEFAULT_PORT = 5433;

export async function createTestDatabaseClient(): Promise<DatabaseClient> {
  return DatabaseClient.init({
    waitUntilConnected: true,
    logger: () => {
      // silent in tests
    },
    connectionParams: {
      host: process.env["DB_HOST"] ?? "localhost",
      user: process.env["DB_USER"] ?? "nestjstemplatev2",
      password: process.env["DB_PASSWORD"] ?? "nestjstemplatev2",
      port: parseInt(process.env["DB_PORT"] ?? String(DEFAULT_PORT), 10),
      database: process.env["DB_NAME"] ?? "nestjstemplatev2",
    },
    poolConfig: {
      min: 1,
      max: 5,
    },
  });
}
