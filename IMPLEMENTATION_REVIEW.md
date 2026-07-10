# Lafken — Implementation Review

Date: 2026-07-10

Reviewer stance: senior principal software architect, full-codebase review (backend, web admin console, SDK packages, persistence, security, tests). Conducted as six parallel deep-dive reviews (architecture, pipeline correctness, persistence/domain, security, SDK, web+tests) followed by an independent verification pass: **every High-severity finding below was re-verified against the code by hand** (marked ✅); Medium/Low findings were confirmed by the originating review with file:line evidence unless marked _plausible_.

## Verification

| Command                            | Result                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `pnpm type-check`                  | Passed.                                                                                                 |
| `pnpm lint`                        | Passed.                                                                                                 |
| `pnpm -F backend dep-check`        | Passed (372 modules) — but see F-A3: the config has blind spots, so "passed" overstates what it checks. |
| `pnpm -F web dep-check`            | Passed (292 modules).                                                                                   |
| `pnpm find-dead-code`              | Passed, no output.                                                                                      |
| `pnpm syncpack:check`              | Passed.                                                                                                 |
| `pnpm check:no-template`           | Passed.                                                                                                 |
| `pnpm validate:deploy`             | Passed (backend/web intg + prod runtime configs).                                                       |
| `pnpm test` (unit, all workspaces) | Passed: 11 tasks. Backend 323, web 483+2 todo.                                                          |
| `pnpm -F backend integration/test` | Passed: 92 passed, 3 skipped (5 consecutive green runs).                                                |
| `pnpm -F backend e2e/test`         | Passed: 95 passed, **33 skipped** — see F-T1: the skips are the core upload→process→serve journey.      |

Environmental notes from this run (local, not code defects unless noted):

- Test-DB host port 5434 collided with an unrelated project's container on this machine; suites were run against a temporary remap (reverted). The port is hardcoded in `docker-compose.test.yml` and `.env.test` — consider making it overridable.
- Integration and E2E share one test database; invoking both suites concurrently produces transient cross-suite failures. Run them sequentially.
- The test-compose ClamAV container never becomes healthy: its entrypoint chown-loops on the read-only `lafken-test.ndb` bind mount (`apps/backend/docker-compose.test.yml:93`). Tests pass because the pipeline specs use the local stub, meaning the real ClamAV adapter is effectively unexercised by the test stack.
- The tusd test/dev container is **crash-looping** — that one is a code defect, see F-P3.

---

## Critical findings

### F-S1 ✅ `download-url` mints working signed URLs to quarantined/rejected/deleted bytes

Severity: **Critical** (security). Found independently by two reviews.

`GET /v1/assets/:publicId/download-url` → `get-asset-download-url.use-case.ts:32-57` performs **no asset-state check** before signing a 5-minute GCS read URL for `asset.props.storageKey`. The preview path explicitly guards this (`assets.controller.ts:246` via `isAssetPreviewable`); download does not. Crucially, quarantine _moves_ the bytes to `_quarantined/<key>` and updates `storage_key` in the same UPDATE (`asset-processing.repository.ts:81`), so the signed URL points at the **quarantined bytes and works**. The endpoint is `@AuthenticatedEndpoint()` only — no role required.

Impact: any authenticated principal, any role, can download virus-flagged or moderation-rejected originals, defeating the quarantine control the whole pipeline exists to enforce. The "move bytes out of imgproxy's reach" defense protects only previews. `deleted` assets are also downloadable (bytes are never removed).

Fix: gate the use case on an explicit ready-state allowlist (mirror the preview guard); consider role-gating download like `/confirm`.

### F-P1 ✅ Worker can resurrect a `deleted` asset to `ready`

Severity: **Critical** (correctness/compliance).

`process-claimed-asset.use-case.ts:98-114` special-cases only `currentState === "uploaded"`; there is **no bail-out for terminal states**. `claimAvailable` never joins on asset state, and `DeleteAssetUseCase` (`delete-asset.use-case.ts`) transitions the asset but **never cancels the `processing_jobs` row** (verified: no job handling in the use case). Scenario: transient error → job released with up-to-10-min backoff → operator deletes the asset (legal, audited) → backoff elapses → worker claims, runs the full pipeline, and commits `deleted → ready` (the CAS matches because `fromState` came from the same fresh read). On the quarantine branch it would even move bytes and flip `deleted → quarantined_virus`.

Fix: after load, if state ∉ {`uploaded`, `processing`} mark the job completed and return (the stale-claim sweeper already has exactly this guard — `reclaim-stale-processing-jobs.use-case.ts:49`); cancel the job row in `DeleteAssetUseCase`.

### F-P2 ✅ Any transient DB error in the worker's timer loops crashes the process

Severity: **Critical** (operational stability).

`processing-worker.service.ts:76-100`: all four loops are `setInterval((): void => void this.tick(), …)`-style with **no try/catch** in `tick()`, `heartbeat()`, or the sweeper use cases, and there is **no `unhandledRejection` handler anywhere in `src/`** (verified by grep). On Node ≥15 a single dropped DB connection during one poll tick is an unhandled rejection → the worker process exits. Its claimed jobs are not released (graceful shutdown never runs) and — since the stale sweeper only runs inside worker processes — a single-worker deployment strands them until restart.

Fix: wrap each timer callback in try/catch with logging/metrics; use `Promise.allSettled` in `heartbeat`.

### F-K1 ✅ Filling in upload-page metadata breaks every confirm (SDK ↔ API contract drift)

Severity: **Critical** (user-facing data integrity).

`lafken-upload-manager.ts:405-410` merges `sharedMetadata` (`externalRefType`, `externalRefId`, `note`, `tags`) into the `confirmUpload` body — but `ConfirmUploadRequestDTO` accepts **only `width`/`height`**, and the global pipe is `whitelist: true, forbidNonWhitelisted: true` (`api-input-validation.pipe.ts:8-9`). Verified end to end. Scenario: user fills "External Ref / Note / Tags" in `UploadAssetsPage.tsx` → bytes land in the bucket → confirm returns 400 → every tile shows `error`, leaving orphaned unconfirmed uploads. It only appears to work today because empty fields serialize away. The SDK test asserts against a client **mock**, which is precisely the fake/real drift the repo's own contract-testing rule exists to catch (see F-T3).

Fix: either add the metadata fields to the DTO (and persist them) or stop sending them; add a backend E2E that confirms with metadata.

---

## High findings

### F-P3 ✅ tusd sidecar crash-loops: `-cors-allow-origin=*` is an invalid regex

`docker-compose.yml:98` and `docker-compose.test.yml:65` pass `-cors-allow-origin=*`; tusd parses the flag as a regex and dies: `error parsing regexp: missing argument to repetition operator` (observed live — the test container was in `Restarting (1)` throughout this review). The entire tus path is down in dev and test. Fix: `-cors-allow-origin=.*`, or drop the flag — but see F-S3 before widening CORS.

### F-P4 tus uploads can never be confirmed (design gap)

`tusd-upload-url-issuer.adapter.ts:31-51` fabricates `<endpoint>/<randomUUID()>` — tusd never learns this ID; finished uploads land under **tusd's own object name**, no hook consumes the `Upload-Metadata` keys (`TUSD_INTERNAL_URL` is explicitly "Reserved for future use; not consumed" — `environment.schema.ts:174`), and `ConfirmUploadUseCase` checks `objectExists(intent.storageKey)` → always `UploadedObjectMissingError` for tus intents. tusd also runs with no `-max-size`, so policy size limits are unenforced on this path. The gated tus E2E cannot currently run (F-P3) so nothing catches this. Fix: implement a tusd `post-finish` hook (or confirm-time move) that relocates the object to `storageKey`; enforce size.

### F-S2 Read endpoints enforce authentication only; the documented role model is client-side

`docs/admin-console.md:34-46` describes role-restricted audiences, but enforcement is the web `AuthGuard` only. Every sensitive **read** endpoint carries `@AuthenticatedEndpoint()` with no `@EndpointRequiredRoles`: the full configuration audit log (actor emails, request IPs, before/after state — `audit.controller.ts:16`), legal-hold case data (`legal-holds.controller.ts:55,75`), storage-binding/integration config (`system.controller.ts:67-190`), and all asset reads. Any valid token, regardless of role, reads everything by calling the API directly. Mutations _are_ correctly role-gated. Distinct from the accepted allow-all object-level authz: this is missing **role** gating that the docs claim exists. Fix: add role decorators to sensitive reads, or document the v1.0 posture honestly.

### F-D1 ✅ Concurrent policy-version creation returns 500 — both retry layers defeat each other

`namespace-write.repository.ts:209-217`: when running inside an ambient UoW (`isAlreadyInTx`), a unique violation on `(namespace_id, version)` aborts the surrounding Postgres transaction, yet the catch retries on the **same aborted connection**; the retry's first query fails with `25P02`, which `isPolicyVersionUniqueViolation` doesn't recognize, so a raw DB error escapes. The use-case retry (`update-namespace-policy.use-case.ts:48-72`) catches only `PolicyVersionConflictError` → raw 500. The exact "two users create version N+1" race this code targets yields a 500. Fix: when `isAlreadyInTx`, translate to `PolicyVersionConflictError` immediately (no repo-level retry) and let the use-case loop re-run in a fresh transaction.

### F-D2 Preset and namespace-metadata flows write business data + audit without UnitOfWork

`create-preset.use-case.ts`, `set-preset-active.use-case.ts`, `update-preset-version.use-case.ts`, `update-namespace-metadata.use-case.ts` each perform a business write then `auditWriteRepo.record(...)` with **no `UnitOfWorkPort`** — and since commit `11cf8db` made audit writes throw, an audit failure now surfaces as a 500 **after** the business write committed: a committed change with no audit row, exactly what ADR 0002 forbids. Worse, `NamespacePresetWriteRepository` uses `this.db.connection` directly (never `ConnectionResolver` — `namespace-preset-write.repository.ts:21,26,57,103`), so preset writes would escape the ambient transaction even if the use cases adopted UoW. ADR 0002's scope claim ("their callers do not combine them with other write repositories") is factually wrong — the callers combine them with the audit repo. Fix: adopt UoW in these four use cases; migrate the preset repo to `ConnectionResolver`; update ADR 0002 (it also still describes the removed error-swallowing catch).

### F-D3 Unbounded pagination `limit` on every list endpoint

`shared/backend-api/shared/pagination-dto-factories.ts:56-63`: `limit` has `@Min(0)` and **no `@Max`** — `?limit=10000000` dumps entire tables on `/audit`, `/assets`, `/legal-holds`, `/quarantine`, `/namespaces`. Bonus: `@Min(0)` permits `limit=0` → `Math.ceil(total/0)` = `Infinity` in `lastPage`. Fix: `@Max(100)` (or per-endpoint caps) and `@Min(1)`.

### F-A4 ✅ Pipeline ignores the CAS result of `transitionAsset` — lost races reported as success

`process-claimed-asset.use-case.ts:100,458,527` discard the `Promise<boolean>` that `transitionAsset` returns ("false if it lost a race — caller decides"); `transitionToTerminal` then unconditionally records the terminal-state metric and marks the job completed. Every _other_ caller checks it (`processing-worker.service.ts:318`, `reclaim-stale-processing-jobs.use-case.ts:89`, `delete-asset.use-case.ts:39`). The DB stays consistent, but jobs/metrics/logs lie about the outcome — and this is the enabling half of F-P1. Fix: branch on the boolean; skip `markCompleted` + metrics on lost race.

### F-A1 Anemic domain models across every aggregate

The core `Asset` entity is `constructor(public readonly props) {}` + `fromProps()` (`asset.entity.ts:39-45`); same for `Namespace`, `NamespacePolicy`, `NamespacePreset`, `LegalHold`. Business rules live in use cases (`policy.props.allowedMimeTypes.includes(...)` in `create-upload-intent.use-case.ts:62-75`; `state.startsWith("quarantined_")` in `release-quarantined-asset.use-case.ts:38`), and the 11-state asset machine has **no transition legality in the domain at all** — enforced only by SQL `WHERE state = :fromState`. CLAUDE.md explicitly forbids this shape; `UploadIntent.isExpired()` and `isAssetPreviewable()` prove the team knows the pattern. Fix: move state predicates/transition rules onto `Asset`, policy checks onto `NamespacePolicy`; consider `@duraflows` (mandated by CLAUDE.md for status-transition processes — see also F-A5).

### F-A2 `AssetsController` bypasses use cases and runs business orchestration inline

`assets.controller.ts:113-117` injects 5 repositories/domain ports alongside 11 use cases. `getPreviewUrl()` (:231-297) is an entire use case implemented in the controller (previewability check, preset matching, GCS source signing, imgproxy signing, TTL math); `buildSignContextResolver()` (:126-173) is application logic; `confirmUpload()` (:476-479) does aggregate composition with sentinel fallbacks (`?? "unknown"`, `?? 0`) that mask data-integrity failures. Violates "use cases are the only entry point to domain logic." Fix: extract `GetPreviewUrlUseCase`; have `ConfirmUploadUseCase` return the slug/version it already resolves internally (it does, then throws them away).

### F-A3 Presentation imports infrastructure — and dependency-cruiser can't see it

`assets.controller.ts:67` imports `SYSTEM_PRESETS` from `assets/infrastructure/`; :71-75 imports raw OTel instruments from `shared/infrastructure/telemetry/metrics` (bypassing the existing `MetricsPort`, which is simply missing the serving metrics). The dep-cruiser config has **no `presentation → infrastructure` rule at all**, its layer rules are scoped to the same feature via a `\1` backreference, and cross-feature imports are `severity: "warn"` — so `pnpm dep-check` passes all of this. Fix: move `SYSTEM_PRESETS` to domain (it is domain data); add serving metrics to `MetricsPort`; add forbidden rules for `presentation → infrastructure` and cross-feature layer violations.

### F-W1 ✅ Legal-holds list pagination is broken — page 2+ unreachable

`LegalHoldsListPage.tsx:284-285`: data is server-paginated (`limit: pageSize`), but `totalPages = Math.ceil(filtered.length / pageSize)` is computed from the **current page's row count**, never from `data.total`. With page size 25 the server returns ≤ 25 rows → `totalPages` is always 1. The "Active holds"/"assets under hold" stats (:301-302) likewise aggregate only the visible page. Fix: use `total` from the paginated response.

### F-T1 ✅ The E2E apex is dark by default: gating env var set nowhere

Gated specs check `process.env["LAFKEN_E2E_REQUIRES_FAKE_GCS"] === "true"`, but the variable is set in **no committed config** — not `.env.test`, not `.env.test.example`, no script, no compose (verified by grep). Consequences of a default run: the upload-confirm, processing-pipeline, preview/download-URL, metrics-emission, and tus E2E specs all skip (the "33 skipped" in every green report); the GCS storage adapter's **only** integration spec skips; and **8 of 9 Playwright specs** skip — including namespace CRUD, legal holds, and storage-binding journeys that don't even need GCS. Two more are hard-`describe.skip`ped because their endpoints don't exist (F-T2). Fix: set the var in `.env.test` (compose already ships fake-gcs), document it in `.env.test.example`, and split the Playwright gate so non-GCS journeys always run.

---

## Medium findings

### Pipeline & concurrency

- **F-P5 Workflow timeout doesn't cancel the pipeline.** `processing-worker.service.ts:230-259` uses `Promise.race` with no abort signal; the losing pipeline keeps running — inserting analyses, mutating derived metadata on a failed asset, and on a late quarantine decision **moving bytes to `_quarantined/`** whose CAS-failed transition then never updates `storage_key` → asset row points at a 404; operator retry burns the budget on `read_object`. The crash-recovery comment at `process-claimed-asset.use-case.ts:482-493` doesn't work either (the skip checks the DB key, which only gets the prefix when the transition commits). Fix: thread an `AbortSignal` through steps; on retry, fall back to `toQuarantinedStorageKey(key)`.
- **F-P6 ✅ `releaseStaleClaim` has no staleness/owner fence.** `processing-job.repository.ts:167-186` — `WHERE asset_id = ? AND state = 'claimed'` only: no `heartbeat_at < :staleBefore` recheck, no `worker_id` match. Two workers' sweepers racing can yank a _fresh_ claim → double-processing (duplicate analyses/audit rows, duplicated quarantine moves, loser can flip the asset to `processing_failed` mid-run). Fix: add both predicates; abort processing when heartbeat returns false.
- **F-P7 ✅ Orphan sweep can expire a just-refreshed intent and delete live bytes.** `markExpired` (`upload-intent-write.repository.ts:75-84`) guards only `consumed_at/expired_at IS NULL` — it never rechecks `upload_url_expires_at < cutoff`, while the sweeper deletes bytes after a stale batch read and `refreshUploadUrl` legitimately revives wall-clock-expired intents. Compounding: the consume UPDATE inside `createUploadedAsset` (`asset-write.repository.ts:34-39`) ignores its rowcount and doesn't check `expired_at`. Fix: add the expiry predicate to `markExpired`; require `expired_at IS NULL` + rowcount=1 on consume.
- **F-P8 Concurrent double-confirm → 500 instead of idempotent success.** Read-then-act idempotency check (`confirm-upload.use-case.ts:48-56`) + ignored consume rowcount + `assets.public_id UNIQUE` → the second concurrent confirm dies on the unique constraint. Sequential retries are fine. Fix: on consume rowcount 0, fall back to the already-consumed lookup.
- **F-P9 Transient DB errors in pipeline bookkeeping are classified permanent.** `runStep` wraps only port calls; the `uploaded→processing` transition, `recordAnalysis`, `updateDerivedMetadata`, and terminal helpers are unwrapped, so a brief DB blip during bookkeeping marks the asset `processing_failed` with no retry — defeating the retry policy for the most common transient failure source.
- **F-P10 Stranded non-terminal states.** Missing storage binding marks the _job_ failed but leaves the _asset_ in `processing` forever (`process-claimed-asset.use-case.ts:119-132`); retry-budget exhaustion while still `uploaded` similarly leaves a dead end (`reclaim-stale-processing-jobs.use-case.ts:111-116`). Nothing recovers either (retry endpoint requires `processing_failed`). Fix: transition to `processing_failed` on the binding path; give `uploaded`+failed-job an operator recovery route.

### Persistence & data

- **F-D4 Quarantine release/reject TOCTOU + non-crash-safe byte move.** `transitionState` has no CAS (`asset-write.repository.ts:130-154` — read state, then unguarded UPDATE); the quarantine guards run outside any transaction, so concurrent release+reject both pass and last-writer-wins. And release moves bytes _before_ the DB transition — a failure between leaves `storage_key` pointing at the quarantine prefix with bytes already moved; retry fails permanently. Fix: add `expectedFromState` to `transitionState`; order DB-then-move or make the move recoverable.
- **F-D5 Preset `active` flag modeled per-version but treated per-preset.** `setActive` flips only the latest version row (`namespace-preset-write.repository.ts:115-118`) while `listPresets` returns _every_ `active = true` row → deactivated presets reappear via older versions, and multi-version presets list duplicates. The assets controller already carries a manual latest-per-name dedupe **as a workaround and says so** (`assets.controller.ts:138-152`). Fix: make activation per-preset (or collapse to latest-per-name in the repository).
- **F-D6 Lift-legal-hold races.** Active-check and asset-id read happen outside the UoW; the UPDATE has no `WHERE active = true` (`legal-hold-write.repository.ts:79-89`) → concurrent lifts both "succeed", the second silently overwriting `lifted_by/lifted_at/lift_reason` on a compliance record and double-auditing. The unbounded `listAssetInternalIds` also loads every affected asset id into memory; the flag recompute could be pure SQL by `legal_hold_id`.
- **F-D7 Missing indexes.** No index on `assets.storage_binding_id`, `assets.policy_version_id`, `upload_intents.{namespace_id,policy_version_id,storage_binding_id}`, `namespaces.{storage_binding_id,current_policy_id}` — `DELETE /storage-bindings` relies on RESTRICT checks that seq-scan `assets`/`upload_intents`. The ever-growing `configuration_audit_log` is filtered by `occurred_by`/`action`/`entity_id` and `ILIKE '%q%'` over three columns with no trgm indexes (assets got pg_trgm for exactly this pattern; audit didn't).
- **F-D8 Dashboard/quarantine count drift.** `dashboard-counts.repository.ts:41` counts two quarantine states; the quarantine context defines three (`quarantined_invalid_format` omitted) → dashboard tile ≠ quarantine list total.

### Architecture & design

- **F-A5 Ceremonial XState machine.** `process-claimed-asset.use-case.ts:76` creates an actor and sends 12 events; `getSnapshot()` is never called anywhere — the machine influences nothing. Either make it authoritative or delete it (and note CLAUDE.md mandates `@duraflows` for status-transition modeling).
- **F-A6 GCS vendor semantics baked into domain ports.** `IGcsBindingDescriptor { bucket; projectId }` lives in the domain contract (`asset-storage.service.port.ts`), and every use case unwraps `binding.getGcsConfig()` — adding S3 would touch every use case. Make the descriptor opaque.
- **F-A7 Framework coupling in the application layer.** 46 use-case files import `@nestjs/common`; `processing-worker.service.ts` uses `@Inject`/`@Optional`/`OnModuleDestroy`. The worker's scheduling shell (timers, shutdown) is a driving adapter and belongs in infrastructure.
- **F-A9 Quarantine release/reject decisions bypass the audit log.** 16 use cases record audit entries; the two highest-stakes human decisions in the system don't (reviewer identity lands only in transition metadata). Also: the 16-fold audit boilerplate wants a shared `AuditRecorder` collaborator.
- **F-A10 Port/config hygiene cluster.** `AssetQueryRepositoryPort` mixes 10 methods across aggregates (cross-aggregate composition is "a service responsibility" per the repo's own rules); `MetricsPort` spans 13 methods yet lacks serving metrics (which caused F-A3's direct OTel import); `authenticated-endpoint.decorator.ts:18` reads `process.env.CLOUD_ENDPOINT_DEFINITION` at import time (env-branching in a production decorator, outside the config module); no `Clock`/`IdGenerator` ports — `new Date()` in 9 application files, `randomUUID()` in use cases, contra CLAUDE.md.
- **F-A8 Zod inside `system` domain** (`gcs-binding-config.schema.ts`) while `PresetParams` hand-rolls validation to stay pure — pick one policy and codify it.

### SDK (`@lafken/*`)

- **F-K2 Failed transfers strand files in `uploading` forever.** Neither manager nor hook listens to Uppy's `upload-error` (manager: only `restriction-failed` + `complete`, `lafken-upload-manager.ts:213,244`); a 403 (URL expired mid-upload) or network failure emits no event → tile spins forever, and the upload page's completion effect never fires. Note `expiresAtByFileId` is written (:347,359) but **never read** — there is no mid-upload refresh.
- **F-K3 Multi-batch state stomp.** On Uppy's `upload` event the hook maps **all** files to `uploading` (`use-image-upload.ts:285-288`), including terminal ones from earlier batches (`allowMultipleUploadBatches: true`) → previously-`ready` tiles regress to a permanent `uploading`.
- **F-K4 No teardown on unmount.** The hook cleanup never calls `cancelAll()`/`uppy.destroy()`; `pollUntilTerminal` keeps issuing authenticated polls up to 10 minutes after navigation. Under `<StrictMode>` (which apps/web uses) the lazy initializer builds a second orphaned Uppy instance.
- **F-K5 Lifecycle/cache cluster.** `cancellableSleep` never resolves on cancel (dead `if (!slept)` branch, leaked pending promises — `lafken-upload-manager.ts:596-604`); `useAssetPresetUrl` never re-resolves after TTL expiry (unlike `<AssetImage>`, which shares the same cache and does); the URL cache map is unbounded/immortal and a `NaN` `expiresAt` would poison an entry as permanently fresh. _Plausible additions:_ clock-skew (>14 min) turns the background refresh into a self-sustaining request loop; evict-during-refresh resurrects stale entries; the transport has no abort/timeout/retry (add `RequestOptions` before 1.0 to avoid a breaking change).
- **F-K6 Packaging/API surface.** `@shared/backend-api` declared as a _runtime_ dependency of the client (one careless non-type import drags NestJS/class-validator into browser bundles — move to dev/peer or lint-guard it); no `sideEffects: false`; peer ranges needlessly narrow (`react ^19.2.4` excludes 19.0–19.2.3); underscore-prefixed internals exported from the package root; `src/types.ts` hand-rolls DTO shapes that already drift from reality (its `IConfirmUploadOptions` disagrees with what the manager sends — F-K1); param shapes and query-string building inconsistent across sub-clients (4 different implementations).

### Web admin console

- **F-W2 URL-as-truth violations across list pages.** `AssetsListPage` validates `page`/`state` search params then ignores them — filters/pagination live in `useState`, so deep links, reload, and back-button silently lose state (`routes/_protected/assets/index.tsx:8-13` vs `AssetsListPage.tsx:47-56`). Audit, Quarantine, and Namespaces pages have no search schema at all. Legal-holds reads `q` once and never writes back.
- **F-W3 Staleness in prod.** Lift-legal-hold deliberately relies on per-asset `staleTime` for detail refresh — but staleTime is 5 min and `refetchOnWindowFocus` is `import.meta.env.DEV` (**off in prod**, and a config-rule violation besides — `query-client.ts:47`): a lifted hold shows as active for up to 5–10 minutes. No mutation anywhere invalidates the audit cache, so an operator's own action is missing from the audit page they open next.
- **F-W4 No error state on list pages.** Failed queries render the "no matches" empty state (`AssetsListPage.tsx:69`, audit/quarantine/legal-holds same) — actively misleading for operators.
- **F-W5 Dead/demo UI residue.** `DeleteAssetDialog` is an orphan (see F-T2); AssetsListPage ships a hardcoded fake filter badge (`MORE_FILTERS_BADGE_PLACEHOLDER = 2`) plus five no-op quick filters and three no-op bulk actions; SettingsPage is entirely static ("Tables render against empty arrays until the BE slices land"); QuarantinePage's `reviewedToday` metric is session-local `useState` that resets on navigation, and it hand-rolls a toast system beside the existing Sonner component.
- **F-W6 Form-layer duplication and gaps.** Validation constants hand-copied across DTO + 3 web files (in sync today, drift by design — export them from `@shared/backend-api`); no unsaved-changes protection anywhere (`useBlocker`/`beforeunload` absent) despite 1000-line forms; `PlaceLegalHoldPage` bypasses the react-hook-form+Zod convention entirely.

### Testing

- **F-T2 The delete-asset ghost feature (three layers).** A hard-skipped E2E ("no `@Delete` handler"), an unwired `DeleteAssetUseCase`, no SDK method, an orphaned fully-built web dialog, **and** `docs/admin-console.md` claiming an "Asset deletion action" with an `lafken_asset_deleter` role that no server code references. Decide: wire it end to end, or delete all layers. (Same doc still documents the _removed_ `AUTH_PROVIDER=mock` backdoor — the app now fails safe, but remove the instructions.)
- **F-T3 No contract tests despite the mandated rule.** Every fake in `test/__fakes__/` duplicates a real adapter with its own independent spec; no shared suite runs against both. F-K1 is the textbook failure this rule prevents (SDK test green against a mock, production 400). Highest-value: `AssetWriteRepositoryPort`/`UploadIntentWriteRepositoryPort` (consume/sweep semantics) and `AssetStoragePort`.
- **F-T4 `audit-write.repository` has no integration spec** — the one repository whose behavior just changed in `11cf8db`; all 15 others comply with the rule.
- **F-T5 Quarantine release/reject have no default-run HTTP coverage** — the console's primary mutating review actions are covered only by an env-gated Playwright spec (i.e., effectively not at all — F-T1).
- **F-T6 Minor.** Six thin read-through use cases lack unit specs; web page tests stub the router wholesale, making the URL-sync layer (exactly where F-W1/W2 live) structurally untestable; relative wall-clock (`Date.now() ± ms`) recurs in use-case specs; one `describe.todo`.

---

## Low / informational

- **Security posture (accepted/minor):** no rate limiting on URL-minting endpoints; imgproxy preview URLs embed no expiry (revocation relies solely on the quarantine byte-move — which F-S1 shows is bypassable); tokens in `sessionStorage` (mitigated by a strong CSP); stale `login.microsoftonline.com` entries in the CSP allowlist; `CORS origin: true` when configured with `*`; JWT `clockTolerance` 0; dev signing keys in compose (documented as rotate-in-prod). Object-level authorization is entirely absent by design for v1.0 — flagged for closure before multi-tenant production, and it presupposes fixing F-S2 first.
- **tusd hardening (before enabling tus):** unauthenticated creation endpoint, `CORS *` with credentials, no pre-create hook validating against a Lafken intent, no max-size — do not expose publicly as configured (compounds F-P4).
- **Worker resource caps:** `readObjectBytes` never passes `maxBytes` though the port supports it — an oversized object OOMs the worker (pair with tusd's unlimited size). `tick()` re-entrancy can exceed the concurrency cap when a claim query outlasts the poll interval. `markFailed`'s asset-transition and job write are two transactions; a crash between them makes the stale sweeper mislabel the job `completed`.
- **Code-quality cluster:** 623-line `ProcessClaimedAssetUseCase` with 4× duplicated step boilerplate; bare `new Error(...)` for invariants where an `ApplicationError` taxonomy exists; entities expose a mutable `props` bag (fields aren't `readonly`); `dateTimeUtility` module-level singleton; a no-op `.catch((err) => { throw err; })`; hand-rolled query-param validation returning 422 where the API rules say 400; repo-thrown domain errors with `slug: "<unknown>"` placeholders that can leak into problem details; `Record<string, any>` mappers discarding the nullability safety `db.types.ts` provides; N+1 in legal-holds listing; `quarantine` context has no domain of its own (it's an assets sub-feature wearing a context costume — bless it or fold it).
- **Doc drift:** ADR 0002 describes the removed audit catch and mis-states preset-write scope; `docs/admin-console.md` documents removed mock auth and a nonexistent delete action; CLAUDE.md/rules still describe "MSAL or Mock" web auth while `app-config.ts` pins `oidc`; `AuthProviderFactory` reads a config value it ignores.
- **i18n/a11y:** hardcoded English validation messages in namespace/policy forms and `"Completing sign-in…"`; audit search input and type filter lack `aria-label`; the hand-rolled quarantine toast has no live region.

## Strengths

1. **The claim queue is textbook.** `SELECT … FOR UPDATE SKIP LOCKED` in a single transaction, every mutation fenced on `worker_id + state='claimed'`, CAS-guarded asset transitions with the audit insert in the same transaction — the hot path cannot double-claim, and most cross-actor races degrade to logged no-ops. (The gaps are at the edges: F-P6's sweeper, F-D4's unguarded sibling API.)
2. **Composition root and config discipline.** Ports as abstract classes wired via `useExisting`/`useFactory`, adapter swapping exactly at the root, a single zod-parsed `environmentConfiguration` with only two `process.env` escapes in the entire repo (F-A10, F-W3).
3. **The UoW/AsyncLocalStorage design is genuinely correct under concurrency** — nested reuse, `isAlreadyInTx` branching, real rollback integration tests, and a real ADR. (Adoption is incomplete — F-D2 — but the mechanism is sound.)
4. **Migration craftsmanship.** Full compliance with the house rules (timestamps, per-table triggers, uuidv7, no CASCADE, idempotent up/down), a deferrable FK cleanly solving the namespace↔policy cycle, pg_trgm where search needs it, `db.types.ts` in sync.
5. **Security fundamentals are clean where they're implemented:** no SQL injection (fully parameterized, LIKE-escaped), no path traversal (server-constructed storage keys), no SSRF, correct JWT validation (issuer/audience/algorithms pinned, JWKS cached), correct imgproxy HMAC, V4 signed-URL constraints baking in content-type and length range, strong CSP, secrets out of git.
6. **Test discipline where tests run:** in-memory fakes instead of mock libraries, real-Postgres repository specs with raw-SQL seeding, E2E asserting DB rows and audit entries, RFC 9457 problem-details mapped to individual form fields in the web app.
7. **Contract-quality port documentation** — transactional behavior, idempotency, and race semantics documented on nearly every port method.

## Priority actions

1. **F-S1** — gate `download-url` on asset state (small change, closes the quarantine bypass).
2. **F-P2** — try/catch the worker timer loops + `unhandledRejection` handler (one bad tick currently kills the worker).
3. **F-P1 / F-A4** — terminal-state bail in the processor, cancel jobs on delete, honor the CAS boolean.
4. **F-K1** — fix the confirm metadata contract (either side); add the missing E2E.
5. **F-T1** — set `LAFKEN_E2E_REQUIRES_FAKE_GCS=true` in `.env.test`, un-gate non-GCS Playwright specs (turns the lights on for everything above).
6. **F-D3** — cap pagination `limit` (one-line DTO change, closes a trivial DoS).
7. **F-S2** — role-gate sensitive reads (audit log, legal holds, system config) or document the posture.
8. **F-D1 / F-D2** — fix the policy-version retry; adopt UoW in preset/metadata flows; refresh ADR 0002.
9. **F-P3 / F-P4** — fix the tusd flag, then implement the post-finish hook (or descope tus from v1.0 — as shipped it cannot work).
10. **F-K2 / F-K3 / F-W1** — upload-error handling, batch-scoped state mapping, legal-holds pagination.
11. **F-A1–A3** — begin de-anemizing the domain (start with `Asset` state transitions), extract `GetPreviewUrlUseCase`, close the dep-cruiser blind spots so the boundary rules are actually enforced.
12. **F-T3** — add contract suites for the storage/intent ports; they would have caught F-K1 and will catch the next one.
