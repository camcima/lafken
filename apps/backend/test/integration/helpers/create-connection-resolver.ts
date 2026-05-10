import { AsyncLocalStorage } from "node:async_hooks";

import { ConnectionResolver } from "@/shared/infrastructure/persistence/connection-resolver";
import { DatabaseAsyncLocalStorage } from "@/shared/infrastructure/persistence/database-async-local-storage";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

/**
 * Creates a ConnectionResolver bound to a DatabaseClient with no active
 * transaction. Use this in integration tests when constructing repositories
 * directly (without NestJS DI).
 *
 * The resolver always returns `db.connection` in this configuration — behavior
 * identical to how repositories worked before UoW was adopted.
 */
export function createConnectionResolver(db: DatabaseClient): ConnectionResolver {
  const als = new DatabaseAsyncLocalStorage(new AsyncLocalStorage());
  return new ConnectionResolver(db, als);
}
