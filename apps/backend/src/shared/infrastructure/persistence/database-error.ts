import { DatabaseError as PgDriverDatabaseError } from "pg";

export type DatabaseError = PgDriverDatabaseError;

export function isDatabaseError(error: unknown): error is DatabaseError {
  return error instanceof PgDriverDatabaseError;
}
