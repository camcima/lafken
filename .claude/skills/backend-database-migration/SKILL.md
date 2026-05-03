---
name: backend-database-migration
description: Creates and manages PostgreSQL database migrations using dbmate. Covers table creation conventions, column standards (UUIDv7, timestamps, triggers), foreign keys, indexes, and the up/down migration pattern. Use when creating or modifying database tables, adding columns, or managing schema changes.
---

# Database Migration

## Tool & Location

- **Tool**: dbmate (not Kysely migrations)
- **Location**: `apps/backend/db/migrations/`
- **Naming**: `YYYYMMDDHHMMSS_<description>.sql`

## Commands

```bash
# Create a new migration file
pnpm --filter backend migrate:new <migration-name>

# Run pending migrations
pnpm --filter backend migrate

# Rollback last migration
pnpm --filter backend migrate:rollback
```

## Migration File Template

```sql
-- migrate:up

CREATE TABLE "work_centers" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "base_name" VARCHAR UNIQUE NOT NULL,
  "location" VARCHAR NOT NULL
);

CREATE TRIGGER trg_set_updated_at_work_centers
  BEFORE UPDATE ON work_centers
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp_function();

-- migrate:down

DROP TABLE "work_centers";
```

## Table Conventions

| Convention      | Rule                                                                  |
| --------------- | --------------------------------------------------------------------- |
| Table names     | Plural, snake_case (`users`, `work_centers`)                          |
| Column names    | snake_case (`email_address`, `created_at`)                            |
| Primary key     | `id UUID PRIMARY KEY DEFAULT uuidv7()`                                |
| Timestamps      | `created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`                    |
| Updated at      | `updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`                    |
| Updated trigger | `trg_set_updated_at_<table_name>` using `update_timestamp_function()` |

## Required Columns (every table)

```sql
"id" UUID PRIMARY KEY DEFAULT uuidv7(),
"created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
"updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
```

The `update_timestamp_function()` trigger is created in the initial migration and shared across all tables.

## UUIDv7

- All tables use `uuidv7()` for primary keys (time-sortable UUIDs)
- The `uuidv7()` function is a PostgreSQL extension/function available in the database
- UUIDs are used in all APIs and external integrations

## Foreign Keys

```sql
ALTER TABLE "users"
  ADD CONSTRAINT "users_work_center_fkey"
  FOREIGN KEY ("current_work_center_id")
  REFERENCES "work_centers" ("id");
```

## Down Migration (ALWAYS include)

Every `-- migrate:up` MUST have a corresponding `-- migrate:down` that fully reverses the changes:

```sql
-- migrate:down

ALTER TABLE "users" DROP CONSTRAINT "users_work_center_fkey";
DROP TABLE "users";
DROP TABLE "work_centers";
```

Drop in reverse order of creation (constraints first, then dependent tables, then parent tables).

## Deletion Policy

- **Hard delete by default** (DELETE FROM)
- Soft delete only when explicitly required: add `deleted_at TIMESTAMPTZ NULL` column

## DB Schema Types (Kysely)

After creating the migration, define corresponding TypeScript types in `infrastructure/persistence/schemas/*.db.ts`:

```typescript
export interface IWorkCenterDbRow {
  id: string;
  created_at: Date;
  updated_at: Date;
  base_name: string;
  location: string;
}

export interface IWorkCenterDbRowInsert {
  base_name: string;
  location: string;
}
```
