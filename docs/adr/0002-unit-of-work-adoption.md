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

The `AuditWriteRepository` is a boundary where errors are explicitly swallowed (best-effort semantics for the audit log). However, the transactional guarantee still matters: the audit entry and the business write must be committed together or rolled back together, not written and silently orphaned.

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

The `AuditWriteRepository`'s internal `try/catch` that swallows errors is preserved. In integration rollback tests, we spy on `record()` directly (bypassing the internal try/catch) so errors propagate to the UoW block and trigger the rollback.

## Scope

Only use cases with genuine cross-repository writes are opted in. Repositories used exclusively in single-repository contexts are left unchanged. The `NamespacePresetWriteRepository` and `UploadIntentWriteRepository` are not wrapped because their callers do not combine them with other write repositories in a way that requires atomicity.

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
- The `AuditWriteRepository` best-effort semantics are preserved: a transient audit-log failure will roll back the business write rather than produce a ghost audit entry. If the requirement changes to "best-effort for audit, commit business write regardless," the scope of `unitOfWork.execute()` must be narrowed to exclude the audit call.
