import { Kysely, Logger as KyselyLogger, PostgresDialect } from "kysely";
import pg, { Pool, PoolConfig } from "pg";
import { lastValueFrom } from "rxjs";

import { retryAsyncFunction } from "@/shared/utils/misc.utils";

// Init default mappers
pg.types.setTypeParser(pg.types.builtins.INT8, (val: string) => BigInt(val));
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (val: string) => new Date(val));
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (val: string) => new Date(val));
pg.types.setTypeParser(pg.types.builtins.TIMETZ, (val: string) => new Date(val));

export class DatabaseClient {
  connection: Kysely<any>; // no database schema as we are not enforcing the query builder usage
  private pool: Pool;

  async isConnected(params: { retryAttempts: number; retryDelayMs: number }): Promise<
    | {
        ok: true;
      }
    | {
        ok: false;
        error: unknown;
      }
  > {
    if (!this.connection) {
      return {
        ok: false,
        error: new Error("Database connection is not initialized"),
      };
    }

    const pingConnection = async () => {
      const conn = await this.pool.connect();
      try {
        await conn.query("SELECT 1");
      } finally {
        conn.release();
      }
    };

    try {
      await lastValueFrom(
        retryAsyncFunction({
          callback: pingConnection,
          maxRetries: params.retryAttempts,
          retryIntervalMs: params.retryDelayMs,
        }),
      );

      return {
        ok: true,
      };
    } catch (error) {
      return {
        ok: false,
        error: error,
      };
    }
  }

  static async init({
    waitUntilConnected,
    logger,
    connectionParams,
    poolConfig,
  }: {
    /**
     * Whether or not wait until the connection is stablished.
     * A new connection will be retried 10 times with 2 seconds of delay
     * between each try.
     */
    waitUntilConnected: boolean;
    /**
     * Whether or not generate query logs.
     */
    logger: KyselyLogger;
    connectionParams: {
      host: string;
      user: string;
      password?: string;
      port: number;
      database: string;
    };
    poolConfig: Omit<PoolConfig, "host" | "user" | "password" | "port" | "database">;
  }): Promise<DatabaseClient> {
    const pool = new Pool({
      ...poolConfig,
      host: connectionParams.host,
      user: connectionParams.user,
      password: connectionParams.password,
      port: connectionParams.port,
      database: connectionParams.database,
    });

    const db = new Kysely({
      dialect: new PostgresDialect({
        pool,
      }),
      log: logger,
      plugins: [],
    });

    const selfDbClient = new DatabaseClient();
    selfDbClient.pool = pool;
    selfDbClient.connection = db;
    if (waitUntilConnected) {
      const isConnectionStablishResult = await selfDbClient.isConnected({
        retryAttempts: 10,
        retryDelayMs: 2_000,
      });
      if (!isConnectionStablishResult.ok) {
        throw new Error("Database connection failed", {
          cause: isConnectionStablishResult.error,
        });
      }
    }

    return selfDbClient;
  }

  async closeConnection(): Promise<void> {
    await this.pool?.end();
  }
}
