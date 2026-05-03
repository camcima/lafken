# ADR 0001 — Primary key strategy: bigserial + UUIDv4

**Status:** Accepted
**Date:** 2026-05-03
**Deciders:** Carlos Cima

## Context

CLAUDE.md prescribes UUIDv7 primary keys (via PostgreSQL 18's `uuidv7()`) for new tables and forbids `gen_random_uuid()` (UUIDv4). The Lafken technical specification (§4.1) takes the opposite position for asset and upload-intent tables: bigserial internal PK + UUIDv4 external `public_id`.

## Decision

Lafken follows the spec for the `assets`, `upload_intents`, `processing_jobs`, `asset_state_transitions`, `asset_analyses`, `namespaces`, `namespace_policies`, `namespace_presets`, `storage_bindings`, `legal_holds`, `legal_hold_assets`, and `configuration_audit_log` tables: internal `bigserial` PKs with external UUIDv4 `public_id` where applicable (assets, upload intents).

This is the sole project deviation from CLAUDE.md's PK rule.

## Rationale

The spec's reasoning is asset-table-specific and well-argued:

- **Index density.** `asset_state_transitions`, `asset_analyses`, and `processing_jobs` carry a `bigint` FK to `assets.id` with one row per asset event. A 16-byte UUID PK doubles index page size at scale.
- **External non-leakage.** UUIDv7 leaks creation timestamps; UUIDv4 doesn't. Assets are addressable by URL — non-leakage is the right property.
- **Operator friendliness.** `bigserial` IDs are vastly easier to discuss in incidents, log messages, and ad-hoc SQL than UUIDs. They never appear externally.

The architectural separation between `id` (internal) and `public_id` (external) is what makes this safe — both at code-review time and at runtime via response mappers and DTOs.

## Consequences

- Repositories use `bigint`/`bigserial` for the `id` column type, not `uuid`.
- Response mappers always source the externally-visible identifier from the `public_id` column or from a slug — never from `id`.
- Code review and integration tests must catch any leakage of internal IDs into API responses, logs routed to third-party destinations, or webhook payloads.
- New non-asset modules added to Lafken should follow the same convention for consistency unless a concrete reason argues otherwise.
