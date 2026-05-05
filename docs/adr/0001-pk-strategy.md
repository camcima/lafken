# ADR 0001 — Primary key strategy: UUIDv7 + UUIDv4 public IDs

**Status:** Accepted
**Date:** 2026-05-03
**Updated:** 2026-05-05
**Deciders:** Carlos Cima

## Context

The initial Lafken slice documents debated `bigserial` internal IDs plus UUIDv4 public IDs. The implementation has since been migrated to UUID primary and foreign keys using PostgreSQL 18's native `uuidv7()` default. Asset and upload-intent tables still expose separate UUIDv4 `public_id` values for externally addressable identifiers.

## Decision

All Lafken tables use `uuid PRIMARY KEY DEFAULT uuidv7()` for internal identifiers and `uuid` foreign keys for relationships.

Externally visible asset and upload-intent identifiers use UUIDv4 `public_id` values. API DTOs expose slugs or UUID strings, never sequential numeric IDs.

## Rationale

- **Consistency.** Every module uses the same internal ID shape, which simplifies repositories, DTOs, tests, and generated Kysely types.
- **Non-enumerability.** Internal IDs are not sequential and are safer if accidentally exposed in logs or operational tooling.
- **Temporal locality.** UUIDv7 preserves useful insertion locality compared with random UUIDv4 while avoiding sequential numeric keys.
- **External opacity.** Public asset URLs keep UUIDv4 `public_id` values so externally shared identifiers do not leak creation timestamps.

## Consequences

- Migrations must use `uuid PRIMARY KEY DEFAULT uuidv7()` for new primary keys.
- Foreign keys must use `uuid`.
- Generated Kysely types must model IDs as strings.
- Response mappers expose slugs, `public_id`, or UUID strings according to the API contract.
