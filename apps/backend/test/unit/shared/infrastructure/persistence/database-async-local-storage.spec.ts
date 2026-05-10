import { AsyncLocalStorage } from "node:async_hooks";

import type { Transaction } from "kysely";
import { describe, expect, it } from "vitest";

import { DatabaseAsyncLocalStorage } from "@/shared/infrastructure/persistence/database-async-local-storage";

describe("DatabaseAsyncLocalStorage.currentTransaction", () => {
  it("returns undefined when no transaction is active", () => {
    const als = new AsyncLocalStorage<{ databaseTransaction: Transaction<unknown> | undefined }>();
    const helper = new DatabaseAsyncLocalStorage(als);
    expect(helper.currentTransaction()).toBeUndefined();
  });

  it("returns the transaction handle when run inside als.run", () => {
    const als = new AsyncLocalStorage<{ databaseTransaction: Transaction<unknown> | undefined }>();
    const helper = new DatabaseAsyncLocalStorage(als);
    const fakeTx = { kind: "fake" } as unknown as Transaction<unknown>;
    als.run({ databaseTransaction: fakeTx }, () => {
      expect(helper.currentTransaction()).toBe(fakeTx);
    });
  });
});
