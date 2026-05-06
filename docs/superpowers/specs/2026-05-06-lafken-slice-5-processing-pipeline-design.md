# Lafken Slice 5 - Processing Pipeline

**Status:** Approved  
**Date:** 2026-05-06  
**Predecessors:** Slice 3 (asset upload happy path), Slice 4 (asset preview by preset)

---

## 1. Goal & Scope

### Goal

After an upload is confirmed, Lafken should process the uploaded image asynchronously and move the asset from `uploaded` through `processing` to a terminal state: `ready`, `rejected`, `quarantined_virus`, `quarantined_moderation`, or `processing_failed`.

The slice establishes the production shape of the processing runtime: a separate worker process, Postgres-backed job claiming, XState per-job orchestration, real image validation and metadata extraction, deterministic local virus/moderation adapters, step timing, and processing evidence for the asset detail timeline.

### In scope

- A separate Nest worker entrypoint in `apps/backend`, using `NestFactory.createApplicationContext(...)`.
- `ProcessingWorkerModule` and processing services under the existing backend package.
- Postgres polling over `processing_jobs`, using `FOR UPDATE SKIP LOCKED`.
- Bounded worker concurrency, heartbeat, graceful shutdown, stale-claim recovery, retry scheduling, and terminal `processing_failed`.
- XState as the short-lived in-memory orchestration engine for each claimed job.
- Real image inspection adapter:
  - Read source object bytes from storage.
  - Detect actual MIME type from magic bytes.
  - Validate parseable image structure.
  - Extract width, height, format, size, SHA-256 content hash.
  - Extract EXIF date/time, GPS, camera/device fields, and remaining JSON-safe EXIF under `capture_context.exif_data`.
- Deterministic local virus scan and content moderation adapters.
- State transitions and analysis rows that provide evidence for asset detail timeline/analysis views.
- Existing API reads become populated with real processing data:
  - `GET /v1/assets`
  - `GET /v1/assets/:publicId`
  - `GET /v1/assets/:publicId/state-transitions`
  - `GET /v1/assets/:publicId/analyses`
  - `GET /v1/assets/:publicId/processing-job`
  - `GET /v1/quarantine`

### Out of scope

- EXIF stripping or any mutation of stored image bytes.
- Re-encoding/canonicalization.
- Real ClamAV, Cloud Vision, Rekognition, or webhook adapters.
- Operator actions: approve quarantine, reject quarantine, retry processing, restore, delete.
- New timeline tables.
- `LISTEN/NOTIFY`; polling is the correctness mechanism.
- Running the worker inside the API process.
- Splitting the worker into a separate workspace or microservice.

---

## 2. Architecture

Slice 5 uses the same backend package with two process types:

- `main.ts` starts the Nest HTTP API.
- A new worker entrypoint, for example `processing-worker.ts`, starts a Nest application context without HTTP controllers.

The worker imports a dedicated `ProcessingWorkerModule` that includes only the dependencies needed for processing: database, logger, assets repositories, storage, image inspection, virus scan, content moderation, and worker services.

The built backend image can run either command. API scaling remains driven by HTTP traffic; worker scaling remains driven by `processing_jobs` queue depth.

### Why XState, not duraflows

The project guideline prefers `@duraflows` over hand-rolled state machines for business workflows. This slice is an intentional exception.

The processing pipeline is a short, tactical byte-processing graph: inspect bytes, scan, optionally moderate, finalize. Durable state already lives in Postgres:

- `assets.state`
- `processing_jobs`
- `asset_analyses`
- `asset_state_transitions`

XState coordinates the currently claimed job in memory. It does not own durable workflow state, and the design does not persist XState snapshots. If a worker dies, the Postgres job row and asset state are enough for another worker to resume or retry.

---

## 3. Components

### Worker runtime

`ProcessingWorkerService` owns the process loop:

- Start a polling loop.
- Claim eligible jobs up to configured concurrency.
- Start a heartbeat loop for claimed jobs.
- Run one XState machine per claimed job.
- Run a stale-claim sweeper periodically.
- Handle `SIGTERM` and `SIGINT`: stop claiming, wait for in-flight work up to a grace timeout, release unfinished jobs.

### Job repository

`ProcessingJobRepositoryPort` is owned by the processing/application layer and implemented in infrastructure with Kysely.

Required operations:

- `claimAvailable(workerId, limit, now)`
- `heartbeat(assetId, workerId, now)`
- `updateCurrentStep(assetId, workerId, step)`
- `releaseForRetry(assetId, workerId, notBefore, attemptNumber, lastError, now)`
- `markCompleted(assetId, workerId, now)`
- `markFailed(assetId, workerId, lastError, now)`
- `findStaleClaims(staleBefore, limit)`
- `releaseStaleClaim(assetId, nextAttemptNumber, now)`

Claiming uses a transaction:

```sql
SELECT asset_id
FROM processing_jobs
WHERE state = 'released'
  AND (not_before IS NULL OR not_before <= now())
ORDER BY not_before NULLS FIRST, created_at
FOR UPDATE SKIP LOCKED
LIMIT :limit;
```

Then the same transaction updates selected rows to `state='claimed'`, sets `worker_id`, `claimed_at`, and `heartbeat_at`.

### Asset processing repository

`AssetProcessingRepositoryPort` writes asset processing outcomes atomically:

- Transition asset state with an expected-state precondition.
- Insert `asset_state_transitions` rows.
- Insert `asset_analyses` rows.
- Update derived asset metadata.
- Read the asset plus pinned namespace policy needed by the worker.

This keeps use cases free of transaction plumbing and avoids leaking Kysely details into domain/application services.

### Storage bytes

The existing `AssetStoragePort` should grow a worker-side read operation, or a sibling object-reading port should be added if that keeps the upload URL responsibilities cleaner.

For Slice 5, reading the whole source object into a `Buffer` is acceptable because reads are bounded by `effective_max_size_bytes` and default worker concurrency is `1`. Streaming can replace this later if memory pressure appears.

### Image inspection

`ImageInspectionPort` is a real adapter in this slice. It receives image bytes and the pinned policy context and returns:

- Actual MIME type.
- Format.
- Size bytes.
- Width and height.
- SHA-256 content hash.
- Normalized capture context.
- JSON-safe raw EXIF remainder.
- Validation decision and reason.
- Adapter name/version.

The infrastructure adapter can use libraries such as `file-type`, `sharp`, `exifr`, and Node `crypto`.

### Virus scan

`VirusScanPort` exists as an abstract port. Slice 5 ships a deterministic local adapter:

- Default decision: clean/pass.
- Test/provider override can return infected.
- Infected result transitions the asset to `quarantined_virus`.

This adapter is not a malware protection claim. Real ClamAV or webhook adapters are later slices.

### Content moderation

`ContentModerationPort` exists as an abstract port. Slice 5 ships a deterministic local adapter:

- Runs only when the pinned policy has `content_moderation` configured.
- Default decision: pass.
- Test/provider override can return flag/quarantine.
- Quarantine result transitions the asset to `quarantined_moderation`.

Real moderation providers are later slices.

---

## 4. Pipeline

### 1. Claim

The worker claims a `processing_jobs` row with `state='released'` and due `not_before`. It sets:

- `state='claimed'`
- `worker_id`
- `claimed_at`
- `heartbeat_at`
- `current_step`

If the asset is not in a processable state, the worker reconciles:

- Already terminal asset: mark job `completed`.
- Missing asset or invariant violation: mark job `failed` and log a structured error.

### 2. Start processing

The worker transitions the asset from `uploaded` to `processing` with:

- `reason='processing_started'`
- `occurred_by='worker:<workerId>'`
- metadata containing worker id, attempt number, and job id/asset id.

If the asset is already `processing` because this is a retry after worker death, the worker continues from persisted job/asset evidence rather than forcing a second `uploaded -> processing` transition.

### 3. Image inspection

The worker reads source object bytes and runs the real image inspection adapter.

Valid image:

- Update asset fields:
  - `mime_type`
  - `size_bytes`
  - `width`
  - `height`
  - `content_hash`
  - `capture_context`
- Insert `asset_analyses` with `analyzer='image_inspection'`, `decision='pass'`, and findings.

Deterministic invalid image:

- Insert `asset_analyses` with `analyzer='image_inspection'`, `decision='error'`, findings, and reason.
- Transition `processing -> rejected`.
- Mark job `completed`.

Reject reasons include:

- `unrecognized_format`
- `mime_type_not_allowed`
- `invalid_image_format`
- `format_inconsistency`

### 4. Virus scan

The worker calls `VirusScanPort`.

Clean:

- Insert `asset_analyses` with `analyzer='virus_scan'`, `decision='pass'`.

Infected:

- Insert `asset_analyses` with `analyzer='virus_scan'`, `decision='quarantine'`.
- Transition `processing -> quarantined_virus` with `reason='virus_detected'`.
- Mark job `completed`.

Transient adapter failure:

- Retry according to the retry policy.

### 5. Content moderation

The worker calls `ContentModerationPort` only when the pinned policy has `content_moderation`.

Pass:

- Insert `asset_analyses` with `analyzer='content_moderation'`, `decision='pass'`.

Quarantine:

- Insert `asset_analyses` with `analyzer='content_moderation'`, `decision='quarantine'`.
- Transition `processing -> quarantined_moderation` with `reason='moderation_quarantined'`.
- Mark job `completed`.

Transient adapter failure:

- Retry according to the retry policy.

### 6. Finalize

If all required checks pass:

- Transition `processing -> ready` with `reason='processing_completed'`.
- Include total duration and per-step summaries in transition metadata.
- Mark `processing_jobs.state='completed'`.

---

## 5. Metadata & Evidence

### Capture context

`assets.capture_context` stores a normalized subset plus the remaining EXIF data:

```ts
{
  captured_at?: string;
  capture_location?: {
    lat: number;
    lng: number;
    altitude_m?: number;
    accuracy_m?: number;
  };
  device?: {
    make?: string;
    model?: string;
    lens_model?: string;
    serial_number?: string;
  };
  camera?: {
    exposure_time?: string;
    f_number?: number;
    iso?: number;
    focal_length_mm?: number;
    orientation?: number;
  };
  exif_data?: Record<string, unknown>;
}
```

Common fields are normalized for stable API/UI consumption. Remaining JSON-safe EXIF tags are kept under `exif_data` so operators can inspect the full extraction result.

GPS is intentionally retained because this product needs capture location and chain-of-custody evidence. Slice 5 treats `exif_handling` as byte-handling policy, not record-retention policy: the worker extracts and stores capture context for every processable image. Source-byte stripping for `strip` and `extract_then_strip` is deferred.

### Analysis rows

`asset_analyses` stores step evidence. Each completed step writes one row per attempt:

```ts
{
  step: "image_inspection",
  adapter: "sharp-image-inspection",
  adapter_version: "1",
  started_at: "2026-05-06T12:00:00.000Z",
  finished_at: "2026-05-06T12:00:00.842Z",
  duration_ms: 842,
  decision: "pass",
  details: {}
}
```

Image inspection findings include actual MIME, declared MIME, size, dimensions, format, hash, normalized capture context, EXIF extraction summary, and validation details.

Virus scan findings include adapter identity, clean/infected decision, signature/test metadata, and timing.

Content moderation findings include adapter identity, configured threshold details, category scores where present, decision, and timing.

### State transitions

`asset_state_transitions` remains the asset lifecycle timeline. Transitions caused by processing include rich metadata:

```ts
{
  worker_id: "worker:abc",
  job_attempt: 1,
  step: "image_inspection",
  duration_ms: 842,
  reason_code: "invalid_image_format"
}
```

Expected transition rows:

- `uploaded -> processing`, reason `processing_started`
- `processing -> ready`, reason `processing_completed`
- `processing -> rejected`, reason from validation
- `processing -> quarantined_virus`, reason `virus_detected`
- `processing -> quarantined_moderation`, reason `moderation_quarantined`
- `processing -> processing_failed`, reason `retry_budget_exhausted`

The final success transition includes total processing duration and per-step summaries:

```ts
{
  worker_id: "worker:abc",
  job_attempt: 1,
  total_duration_ms: 2348,
  steps: [
    { step: "image_inspection", decision: "pass", duration_ms: 842 },
    { step: "virus_scan", decision: "pass", duration_ms: 210 },
    { step: "content_moderation", decision: "pass", duration_ms: 1296 }
  ]
}
```

Heartbeats and short retry attempts should not create state-transition rows. They belong in `processing_jobs` and structured logs. Exhausted retries create a terminal transition to `processing_failed`.

---

## 6. Reliability

### Polling

Defaults:

- Poll interval: `1000ms`.
- Worker concurrency: `1`.
- Claim batch size: equal to remaining concurrency.

These values are configuration, parsed once at startup in `environment.configuration.ts`.

### Heartbeat

The worker heartbeats claimed jobs every `10s` by default. Heartbeat updates include a precondition on `worker_id` so a stale worker cannot overwrite a claim after it was reclaimed.

### Retry policy

Transient failures are retried. Deterministic validation failures and terminal provider decisions are not retried.

Default retry/backoff shape:

- Short in-memory XState retries: `1s`, `5s`, `15s`.
- Released retries: `1m`, `5m`.
- Jitter: random delay between 50% and 100% of the nominal delay.
- Max attempts: configurable, default `5`.

When retries are released to Postgres:

- `processing_jobs.state='released'`
- `not_before=now()+backoff`
- `attempt_number` increments
- `last_error` and `last_error_at` are updated
- `worker_id`, `claimed_at`, and `heartbeat_at` are cleared

### Stale claim recovery

The sweeper finds jobs with `state='claimed'` and `heartbeat_at` older than the stale threshold, default `60s`.

Recovery logic:

- If the asset is terminal, mark job `completed`.
- If attempts remain, release the job with incremented attempt count.
- If attempts are exhausted, transition asset to `processing_failed` and mark job `failed`.

### Job states

Existing job state values are `released`, `claimed`, and `completed`. Slice 5 adds `failed` as a practical terminal job state so operators and API responses can distinguish exhausted processing from successful completion.

Asset state remains the user-facing truth:

- `ready`
- `rejected`
- `quarantined_virus`
- `quarantined_moderation`
- `processing_failed`

---

## 7. API & UI Impact

Slice 5 does not add new operator actions.

Existing read endpoints start returning real processing data:

- `GET /v1/assets` shows assets moving from `uploaded` to `processing` to terminal states.
- `GET /v1/assets/:publicId` returns populated metadata fields.
- `GET /v1/assets/:publicId/state-transitions` returns processing timeline events.
- `GET /v1/assets/:publicId/analyses` returns image inspection, virus scan, and moderation evidence.
- `GET /v1/assets/:publicId/processing-job` returns current step, attempt, claim, heartbeat, and last error.
- `GET /v1/quarantine` returns real quarantined assets.

The current web asset detail page still uses demo data. This slice's responsibility is to store and expose the backend evidence in the existing API shapes. Wiring the asset detail page to live detail/transition/analysis/job endpoints can happen as a focused UI slice if it is not already done by the time Slice 5 lands.

---

## 8. Testing

### Unit tests

- Job claiming service:
  - claims eligible jobs
  - skips future `not_before`
  - sets worker id and claim timestamps
  - respects concurrency
- Processing orchestration:
  - `uploaded -> processing -> ready`
  - deterministic invalid image -> `rejected`
  - infected result -> `quarantined_virus`
  - moderation quarantine -> `quarantined_moderation`
  - transient failure -> released retry
  - retry exhausted -> `processing_failed`
- Image inspection adapter:
  - valid JPEG/PNG fixture extracts MIME, dimensions, hash, and EXIF/capture context
  - invalid bytes reject deterministically
- EXIF normalization:
  - date/time
  - GPS
  - camera/device fields
  - JSON-safe `exif_data`
- Local virus/moderation adapters:
  - deterministic clean/pass defaults
  - configured infected/flagged outcomes
- Evidence writers:
  - analysis rows include `started_at`, `finished_at`, `duration_ms`
  - state-transition metadata includes worker id, attempt, step, duration

### Integration tests

Use the shared Postgres test helpers.

- `ProcessingJobRepository`:
  - `FOR UPDATE SKIP LOCKED` claim behavior
  - heartbeat
  - release with backoff
  - mark completed/failed
  - stale claim query
- `AssetProcessingRepository`:
  - state transition with preconditions
  - derived asset metadata update
  - analysis insert
  - terminal state transition metadata
- Worker service:
  - seeded asset + processing job + fake storage object bytes reaches `ready`
  - seeded adapter outcomes reach rejected/quarantine/failure states

### E2E

Keep E2E thin.

- Upload/confirm a real image fixture to fake GCS.
- Run the worker once or start the worker process for the test.
- Assert:
  - asset reaches `ready`
  - metadata fields are populated
  - state transitions include processing start and completion
  - analyses include image inspection and virus scan
  - processing job is completed

Quarantine and rejected cases can be integration tests unless an E2E fixture is cheap and deterministic.

---

## 9. Rollout Notes

- The API process and worker process deploy from the same backend artifact with different commands.
- Worker startup should fail fast if required worker config is invalid.
- Deterministic local scan/moderation adapters are acceptable for Slice 5 but are not production-grade security integrations.
- Production deployments that require true virus scanning should treat real scanner adapter work as a follow-up before claiming malware protection.
- No storage bytes are rewritten in this slice; source objects retain their original embedded metadata.
