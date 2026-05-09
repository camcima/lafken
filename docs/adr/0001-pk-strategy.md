# ADR 0001 — Primary key strategy: UUIDv7 + UUIDv4 public IDs

**Status:** Accepted (re-affirmed for the v1.0 re-baseline on 2026-05-09)
**Date:** 2026-05-03
**Updated:** 2026-05-09
**Deciders:** Carlos Cima

## Context

Slice 0 of Lafken (foundation) shipped with `bigserial` internal primary keys plus UUIDv4 `public_id` columns on the externally-addressable tables, following the v0.3 specification. `CLAUDE.md` simultaneously mandates UUIDv7 primary keys via PostgreSQL 18's native `uuidv7()` and forbids `gen_random_uuid()` as a primary-key default. The two collided in code review.

The `2026-05-04-lafken-uuid-pk-migration` design and plan resolved the collision by migrating every primary and foreign key to `uuid` with `default uuidv7()`, and the implementation has been on UUIDv7 internal IDs since slice 2b. The v1.0 re-baseline (`docs/superpowers/specs/2026-05-09-lafken-v1-rebaseline-design.md`) re-affirms the migrated shape as the v1.0 contract and rewrites spec §4.1 to match.

## Decision

All Lafken tables use `uuid PRIMARY KEY DEFAULT uuidv7()` for internal identifiers and `uuid` foreign keys for relationships. Migrations must use `uuidv7()`; `gen_random_uuid()` is reserved for `public_id` columns only.

Only the `assets` and `upload_intents` tables carry a `public_id` column. Those columns are typed `uuid not null unique default gen_random_uuid()` (UUIDv4). API DTOs expose slugs (namespaces, presets) or UUID strings (asset / upload-intent `public_id`); internal UUIDv7 IDs never cross the service boundary.

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
- The non-leakage rule of spec §4.1 still applies. UUIDv7 embeds a millisecond creation timestamp; leaking a stream of internal IDs would expose creation-time information and rough volume. Code review and integration tests guard the boundary.
