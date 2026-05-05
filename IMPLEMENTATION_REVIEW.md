# Lafken Implementation Review

Date: 2026-05-05

This review covers the current backend, web app, shared DTO package, and the project/specification documents under `docs/superpowers`. The project is still under active development, so demo data, deferred slices, and mocked behavior are treated as acceptable when they are explicit and isolated. The findings below focus on places where the current implementation can fail, mislead operators, or drift away from the stated architecture.

## Remediation Status

Updated 2026-05-05 after the follow-up implementation pass:

- Fixed the backend E2E cleanup failure by deleting `namespace_presets` before namespaces.
- Added storage-binding in-use protection and HTTP 409 mapping.
- Added repository-level duplicate/create conflict translation for storage bindings, namespaces, and namespace presets.
- Aligned Kysely generated types and the database client with the repo's snake_case query style.
- Made frontend demo data opt-in with `VITE_DEMO_DATA=true` and stopped replacing valid API zero counts with demo values.
- Set `VITE_MOCKED_API=false` in `.env.example` because the MSW handler list is empty.
- Updated the stale UUID/auth/problem-details/OpenAPI descriptions called out below.

The remaining `pnpm find-dead-code` findings are mostly deferred frontend hooks/demo exports and public DTO/type surfaces; they still need product-slice triage.

## Executive Summary

The implementation is broadly coherent for an in-progress vertical-slice product: backend type-checking, linting, unit tests, integration tests, and both app builds pass. The main correctness issue found is a failing backend E2E suite caused by test cleanup that was not updated after namespace presets were introduced. The main product/architecture risk is that frontend demo fallbacks are now mixed with live API data in ways that can mask real empty states or API behavior.

The backend has a strong domain/use-case/repository structure, but a few persistence boundaries still leak database errors instead of translating them into domain errors. In particular, storage binding deletion does not use the existing `StorageBindingInUseError`, and create flows rely on pre-read uniqueness checks without catching database uniqueness races.

Several docs and generated API descriptions still describe the original template or earlier architecture decisions: bigserial primary keys, Azure AD auth naming, RFC7807 exception handling, and "numeric ID as string" DTO comments. The current implementation has moved to UUIDv7 IDs, OIDC/mock auth providers, and RFC9457 problem details.

## Verification Results

| Check                              | Result   | Notes                                                                                                         |
| ---------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `pnpm -F backend type-check`       | Pass     | Local shell uses Node `v20.11.1`; repo requires `>=22.0.0`.                                                   |
| `pnpm -F web type-check`           | Pass     | Same Node version warning.                                                                                    |
| `pnpm -F backend lint`             | Pass     | Same Node version warning.                                                                                    |
| `pnpm -F web lint`                 | Pass     | Same Node version warning.                                                                                    |
| `pnpm -F backend test`             | Pass     | 41 test files, 159 tests.                                                                                     |
| `pnpm -F web test`                 | Pass     | 53 test files, 483 passed, 2 todo.                                                                            |
| `pnpm -F backend integration/test` | Pass     | Required localhost access outside the sandbox. 16 files, 44 tests.                                            |
| `pnpm -F backend e2e/test`         | Fail     | Required localhost access outside the sandbox. Failure is a real FK cleanup issue in the dashboard E2E suite. |
| `pnpm -F backend build`            | Pass     | Same Node version warning.                                                                                    |
| `pnpm -F web build`                | Pass     | Vite/Rolldown build completes.                                                                                |
| `pnpm find-dead-code`              | Findings | Script intentionally uses `--no-exit-code`; see dead-code section.                                            |

## High Priority Findings

### 1. Backend E2E Suite Fails After Namespace Presets Are Created

**Evidence**

- `test/e2e/namespaces/presentation/namespace-presets-controller/post-preset-versions.e2e-spec.ts` creates rows in `namespace_presets`.
- `test/e2e/dashboard/presentation/dashboard-controller/get-overview.e2e-spec.ts:25-34` deletes `namespace_policies` and then `namespaces`, but never deletes `namespace_presets`.
- The failing run reports a foreign-key violation on `namespace_presets_namespace_id_fkey` when the dashboard suite tries to delete namespaces.

**Impact**

The backend E2E suite is not currently reliable. This is not just test noise: it shows that shared test database cleanup has drifted from the schema as new slices were added. Similar problems will recur as asset and policy tables grow.

**Recommendation**

Add `deleteFrom("namespace_presets")` before deleting `namespace_policies` or `namespaces` in the dashboard E2E cleanup. Prefer a shared E2E cleanup helper that deletes all mutable tables in FK order, so future schema additions do not require each suite to rediscover the dependency graph.

### 2. Deleting an In-Use Storage Binding Leaks the Database Constraint Instead of a Domain Error

**Evidence**

- `apps/backend/src/system/application/use-cases/delete-storage-binding.use-case.ts:19-25` checks that the binding exists and then deletes it.
- `apps/backend/src/system/domain/errors/storage-binding-in-use.error.ts:3-9` defines `StorageBindingInUseError`, but it is unused.
- `apps/backend/db/migrations/20260503154428_add-namespaces.sql` creates `namespaces.storage_binding_id` as a foreign key with restrictive behavior.

**Impact**

Once namespaces reference storage bindings, deleting a binding in use will fail at the database layer. Unless that FK error is translated, the API can return a generic 500 or infrastructure-shaped error instead of the intended domain error. This is a user-visible correctness and API-contract issue.

**Recommendation**

Either:

- Query for referencing namespaces before deletion and throw `StorageBindingInUseError`, or
- Catch PostgreSQL FK violation `23503` in the write repository and translate it to `StorageBindingInUseError`.

Add API/E2E coverage for "cannot delete a storage binding used by a namespace".

## Medium Priority Findings

### 3. Create Flows Rely on Pre-Read Uniqueness Checks and Can Race

**Evidence**

- `apps/backend/src/system/application/use-cases/create-storage-binding.use-case.ts:43-63` checks `findByName()` before `create()`.
- `apps/backend/src/namespaces/application/use-cases/create-namespace.use-case.ts:22-27` checks `findBySlug()` before `create()`.
- `apps/backend/src/namespaces/application/use-cases/create-preset.use-case.ts:34-39` checks `findByNamespaceIdAndName()` before `createPreset()`.
- The repositories do not consistently catch unique constraint violations for these creates.

**Impact**

The pre-read is useful for normal control flow, but it is not sufficient under concurrent requests. If two requests pass the pre-check together, the database unique constraint wins and a raw persistence error can escape the domain/presentation mapping.

**Recommendation**

Keep the pre-read for clear happy-path errors, but also catch PostgreSQL unique violation `23505` at repository boundaries and translate it to the same domain errors used by the pre-check:

- `DuplicateStorageBindingNameError`
- `DuplicateNamespaceSlugError`
- `DuplicatePresetNameError`

Add one concurrency or repository-level test per create path.

### 4. Generated Kysely Types Are Unused and Do Not Match the Current Query Style

**Evidence**

- `apps/backend/src/shared/infrastructure/persistence/database-client.ts:14` declares `connection: Kysely<any>`.
- `apps/backend/src/shared/infrastructure/persistence/database-client.ts:101` configures `plugins: []`.
- `apps/backend/src/shared/infrastructure/persistence/db.types.ts` is generated with camelCase table and column names, such as `storageBindings` and `storageBindingId`.
- Repository queries currently use snake_case table and column names such as `storage_bindings` and `storage_binding_id`.
- `pnpm find-dead-code` reports the generated DB exports as unused.

**Impact**

The project appears to have invested in generated database types, but the active Kysely client bypasses them. This removes a major compile-time safety benefit and creates confusion about whether queries are expected to be camelCase or snake_case.

**Recommendation**

Choose one convention and make the database client enforce it:

- If code should stay snake_case, regenerate `db.types.ts` without camel-case conversion and change `DatabaseClient.connection` to `Kysely<DB>`.
- If TypeScript code should be camelCase, add the appropriate Kysely camel-case plugin and update repository queries to use the generated names.

After that, remove or justify the remaining `any` database type escape hatch.

### 5. Frontend Demo Data Is Mixed With Live API Data in Ways That Can Hide Real States

**Evidence**

- `apps/web/src/features/namespaces/components/NamespaceDetailPage.tsx:405-416` falls back to `demoToNamespaceDTO()` when the API returns no namespace for a demo slug.
- `apps/web/src/features/namespaces/components/NamespaceDetailPage.tsx:552-570` renders demo overview/policy/preset tabs whenever `demoNs` exists, even when `namespaceData` came from the API.
- `apps/web/src/features/dashboard/components/HomePage.tsx:160-207` combines live dashboard counts with demo queue/event data and falls back to demo KPI values when API counts are zero.
- `apps/web/src/features/assets/components/AssetsListPage.tsx`, `apps/web/src/features/audit/components/AuditPage.tsx`, `apps/web/src/features/quarantine/components/QuarantinePage.tsx`, and `apps/web/src/features/legal-holds/components/LegalHoldsListPage.tsx` are still demo-driven while API hooks exist.
- `apps/web/src/features/system/components/SystemPage.tsx:399-440` displays demo storage bindings when no real storage bindings exist.

**Impact**

Demo data is reasonable during development, but the current fallback behavior can make a connected environment look healthier or more populated than it is. It can also bypass real namespace policy/preset views for slugs that collide with demo namespaces.

**Recommendation**

Gate demo behavior behind one explicit mode, such as `VITE_DEMO_DATA=true`, and make live API mode strict:

- Do not replace valid zero counts with demo values.
- Do not render demo namespace internals when an API namespace exists.
- Make demo storage bindings visually and structurally distinct from persisted bindings, or remove them from workflows that create real namespaces.
- Add tests for "empty API state remains empty" on dashboard and namespace detail pages.

### 6. OpenAPI and Architecture Docs Are Behind the Implementation

**Evidence**

- `docs/adr/0001-pk-strategy.md` still describes `bigserial + UUIDv4`, while migrations use UUIDv7 primary keys.
- `docs/SYSTEM_ARCHITECTURE_OVERVIEW.md` still references `template-emantto-project`, `AzureAdBearerAuthnStrategy`, `CatchAllExceptionsForHttp`, RFC7807, and bigserial deviations.
- `apps/backend/docs/be-openapi.yaml` and `apps/backend/deploy/endpoints/openapi.yaml.erb` describe the backend as "template-emantto-project" and describe storage binding IDs as "Numeric ID as string for bigint-safety".
- `shared/backend-api/presentation/system/storage-binding-response.dto.ts:4` has the same stale numeric-ID description.

**Impact**

These docs can lead implementers toward the wrong ID strategy, auth model, and error contract. That is especially risky because the project is using docs and implementation plans to coordinate incremental slices.

**Recommendation**

Update docs and generated API descriptions to match current decisions:

- UUIDv7 internal IDs and UUIDv4 public asset IDs.
- OIDC/mock auth provider naming.
- RFC9457 problem details.
- Current project name and package naming strategy.
- Current storage binding response ID semantics.

Also regenerate OpenAPI after updating DTO comments.

## Low Priority Findings

### 7. Dead-Code Report Needs Triage

**Evidence**

`pnpm find-dead-code` reports unused exports including:

- `StorageBindingInUseError`
- `IntegrationRow`
- `MainLayout`
- API hooks such as `useAssets`, `useAuditEntries`, `useLegalHolds`, `useQuarantine`, `useIntegrations`, and `useSystemHealth`
- Generated DB types in `db.types.ts`
- Many exported entity prop interfaces and DTO type exports

**Impact**

Some of this is expected public surface for future slices, but the current report mixes intentional future exports with real stale code. That reduces the value of the dead-code check.

**Recommendation**

Triage the list into three groups:

- Wire now: code that should be active, such as `StorageBindingInUseError`.
- Keep intentionally: public DTO/types or future slice hooks, with documented `knip` ignores.
- Remove: stale components/config such as unused layout components or comments that no longer match code.

### 8. Mock API Configuration Is Ambiguous

**Evidence**

- `apps/web/.env.example:30` sets `VITE_MOCKED_API=true`.
- `apps/web/src/mocks/handlers.ts:1` exports an empty handler list.

**Impact**

A developer following `.env.example` enables MSW, but no mock responses are registered. Requests then pass through with warning/noise rather than providing a coherent mocked API.

**Recommendation**

Either set `VITE_MOCKED_API=false` by default or add representative handlers for the current demo mode. The key is to make "mocked API" mean either no network dependency or clearly disabled.

### 9. Local Toolchain Version Can Skew Results

**Evidence**

All `pnpm` commands emitted:

`Unsupported engine: wanted: {"node":">=22.0.0"} (current: {"node":"v20.11.1","pnpm":"10.10.0"})`

**Impact**

The checks passed under Node 20, but the repo declares Node 22+. Build, test, and dependency behavior may differ in CI or on another developer machine.

**Recommendation**

Add or verify a committed toolchain pin such as `.nvmrc`, `.node-version`, or Volta configuration, and make local setup docs point to it.

### 10. GCS Project ID Validation and Runtime Use Are Inconsistent

**Evidence**

- `apps/backend/src/system/infrastructure/services/gcs-bucket-exists-checker.adapter.ts:32-44` configures the Google Storage client using credential project ID or `"fake-gcs"`.
- The validated storage binding `config.projectId` is persisted, but it is not used to construct or scope the bucket-existence check.

**Impact**

This may be acceptable if bucket names are globally unique and credentials determine access, but the current domain model asks users for a project ID and then does not use it during validation. That can confuse operators and tests.

**Recommendation**

Clarify the intended GCS semantics. If `projectId` is informational metadata, document that. If it is meant to scope validation, pass it through to the adapter/client configuration or introduce a provider abstraction that can validate bucket/project pairs.

## Documentation Alignment Notes

The `docs/superpowers` plans generally match the current modular shape: system storage bindings, namespace policies, namespace presets, assets, legal holds, quarantine, audit, and dashboard slices. The drift is mostly in older shared docs and generated API descriptions rather than the slice plans.

The following documents should be reviewed together after the implementation stabilizes:

- `docs/adr/0001-pk-strategy.md`
- `docs/SYSTEM_ARCHITECTURE_OVERVIEW.md`
- `apps/backend/docs/be-openapi.yaml`
- `apps/backend/deploy/endpoints/openapi.yaml.erb`
- `shared/backend-api/presentation/system/storage-binding-response.dto.ts`
- Root `package.json` and package naming references, if the deferred workspace rename is now ready.

## Design Opportunities

1. **Centralize database cleanup for integration and E2E tests.** Current suites duplicate cleanup order. A single helper can encode FK order and reduce schema-drift failures.

2. **Normalize repository error translation.** Persistence repositories should translate known PostgreSQL errors into domain errors consistently. This keeps use cases and presentation filters independent of infrastructure details.

3. **Finish the typed Kysely decision.** The project should either fully use generated `DB` types or remove the generated file and related dead-code noise until the team is ready to enforce typed queries.

4. **Make demo mode a product-level concept.** Demo data should be an explicit mode with predictable behavior, not fallback logic inside individual pages. This will make the transition to live data much easier.

5. **Promote authorization from placeholder to policy boundary when resource mutations grow.** `AuthorizationPort` exists, but most current use cases are not resource-authorized. The slice docs say resource-level authorization is deferred; keep that decision visible before production hardening.

6. **Keep OpenAPI generated from current DTO comments.** Several stale descriptions appear in generated OpenAPI, which means the source annotations need cleanup before regeneration.

## Recommended Next Steps

1. Fix the dashboard E2E cleanup by deleting `namespace_presets` before namespaces, then rerun `pnpm -F backend e2e/test`.
2. Implement in-use storage binding deletion handling and add E2E coverage.
3. Add repository-level unique/FK error translation for create/delete paths.
4. Decide and implement the Kysely typing convention.
5. Put demo data behind one explicit frontend mode and remove zero-state replacement in connected mode.
6. Update stale architecture, ADR, DTO, and OpenAPI descriptions.
7. Triage `pnpm find-dead-code` into intentional public surface, deferred slice code, and removable code.
