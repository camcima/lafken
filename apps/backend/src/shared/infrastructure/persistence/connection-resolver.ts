import { Injectable } from "@nestjs/common";
import type { Kysely, Transaction } from "kysely";

import { DatabaseAsyncLocalStorage } from "./database-async-local-storage";
import { DatabaseClient } from "./database-client";
import type { DB } from "./db.types";

/**
 * Returns the Kysely connection a repository should use right now: the active
 * UnitOfWork transaction if one is bound, otherwise the default connection.
 *
 * Use this from every repository method (read AND write). Reads inside a
 * UnitOfWork must see in-flight writes — that's the read-your-writes
 * contract. Reads outside a UnitOfWork are simple selects on the default
 * connection.
 */
@Injectable()
export class ConnectionResolver {
  constructor(
    private readonly db: DatabaseClient,
    private readonly als: DatabaseAsyncLocalStorage,
  ) {}

  resolve(): Kysely<DB> | Transaction<DB> {
    return (this.als.currentTransaction() as Transaction<DB> | undefined) ?? this.db.connection;
  }
}
