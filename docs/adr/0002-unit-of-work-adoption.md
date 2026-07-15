# ADR 0002 — Unit of Work adoption for cross-repository write flows

**Status:** Accepted
**Date:** 2026-05-10
**Deciders:** Carlos Cima

## Context

Several use cases in Lafken perform writes to more than one repository within a single logical operation. Before this change, those writes were independent database calls: each repository opened its own transaction internally. If a later write failed, the earlier one was already committed, leaving the database in a partial state that violated the intended invariants.

Concrete examples of affected flows:

- `ConfirmUploadUseCase` — creates an asset row (plus a state-transition row and a processing-job row via `AssetWriteRepository`) and then records an audit-log entry via `AuditWriteRepository`.
- `PlaceLegalHoldUseCase` / `LiftLegalHoldUseCase` — writes a `legal_holds` row, updates M2M `legal_hold_assets`, and flips denormalized flags on `assets`, all inside `LegalHoldWriteRepository`, and then records an audit-log entry.
- Namespace lifecycle use cases (`CreateNamespaceUseCase`, `ArchiveNamespaceUseCase`, `UnarchiveNamespaceUseCase`, `UpdateNamespacePolicyUseCase`) — each writes to `NamespaceWriteRepository` and then records an audit-log entry.

The `AuditWriteRepository` throws on failure (best-effort swallowing was removed in commit `11cf8db`). The transactional guarantee is therefore load-bearing: the audit entry and the business write must be committed together or rolled back together — an audit failure after a committed business write would leave a change with no audit row.

## Decision

Introduce a `UnitOfWorkPort` abstract class in the application layer. The `DatabaseUnitOfWork` adapter in the infrastructure layer implements it using Kysely's `db.transaction().execute()` combined with Node.js `AsyncLocalStorage` to propagate the active transaction handle across the call stack without threading it through every method signature.

A new `ConnectionResolver` infrastructure service reads the ambient transaction (if one is active) from `DatabaseAsyncLocalStorage` and returns it; otherwise it returns the default `Kysely` connection. Repositories that need to participate in an outer transaction accept a `ConnectionResolver` in their constructor and call `resolver.resolve()` instead of using `db.connection` directly. They preserve their own internal transaction for the no-UoW case:

```typescript
const conn = this.resolver.resolve();
const isAlreadyInTx = conn !== this.db.connection;
const work = async (tx) => {
  /* ... */
};
if (isAlreadyInTx) return work(conn);
return this.db.connection.transaction().execute(work);
```

Use cases that cross repository boundaries wrap all writes in `unitOfWork.execute()`. Reads that must happen before the transaction (and do not need to see the in-progress writes) are kept outside the UoW block to avoid holding the transaction open unnecessarily.

`UnitOfWorkPort` and `ConnectionResolver` are exported by the shared `DatabaseModule`, making them available to all feature modules without per-module wiring changes.

Integration rollback tests force the audit write to fail through a real database mechanism — an unparseable value for the `inet`-typed `configuration_audit_log.request_ip` column — rather than by mocking or spying on the repository under test. This exercises the same code path production would take.

## Scope

Use cases that combine a business write with an audit write (or any second repository) are opted in. This includes the namespace lifecycle use cases, the legal-hold use cases, `ConfirmUploadUseCase`, and — as of the F-D2 remediation — `CreatePresetUseCase`, `SetPresetActiveUseCase`, `UpdatePresetVersionUseCase`, and `UpdateNamespaceMetadataUseCase`. `NamespacePresetWriteRepository` participates in ambient transactions via `ConnectionResolver` like its siblings. `UploadIntentWriteRepository` remains single-repository in its callers and is unchanged.

## Rationale

- **Atomic writes.** Multi-step writes now commit together or roll back together, eliminating partial-state failures.
- **Transparent propagation.** `AsyncLocalStorage` avoids viral `tx` parameter threading through every layer. Repositories remain unaware of whether they are called standalone or inside a larger UoW.
- **Backward compatibility.** Repositories keep their internal transaction for the no-UoW path, so they continue to work in standalone integration tests and in any context where no outer UoW is active.
- **Testable in isolation.** The `FakeUnitOfWork` adapter simply calls `fn()` directly, which keeps unit tests lightweight and free of database dependencies.
- **Minimal footprint.** The pattern is adopted conservatively — only where there is a proven need for atomicity.

## Consequences

- Any future use case that writes to two or more repositories must wrap those writes in `unitOfWork.execute()` and inject `UnitOfWorkPort`.
- Any new repository that participates in transactional use cases must accept a `ConnectionResolver` constructor argument and apply the branching pattern.
- Integration rollback tests are required for every adopted use case (see `test/integration/<context>/use-cases/*-uow-rollback.spec.ts`).
- Audit writes are all-or-nothing with the business write: a transient audit-log failure rolls back the business write. If the requirement ever changes to "best-effort for audit, commit business write regardless," the scope of `unitOfWork.execute()` must be narrowed to exclude the audit call.
