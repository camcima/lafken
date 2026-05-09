**Lafken**

Asset Management Service

*Technical Specification*

Version 0.4 — Draft

May 9, 2026

Supersedes v0.3 in part. The cuts and decisions applied in this revision are recorded in `docs/superpowers/specs/2026-05-09-lafken-v1-rebaseline-design.md` (design) and `docs/superpowers/plans/2026-05-09-lafken-v1-1-scope-rebaseline-plan.md` (implementation).

*Lafken means* 

*“sea”* in Mapudungun, the language of the Mapuche people

of southern Chile and Argentina.

# **Table of Contents**

# **1\. Executive Summary**

## **1.1 What Lafken is**

Lafken is an asset management service for organizations that handle user-uploaded images at scale. It provides a single, opinionated platform for receiving, validating, processing, storing, and serving images across many applications — replacing the ad hoc, per-application image handling that typically accumulates in large engineering organizations.

Lafken is built around a core insight: image handling is a cross-cutting concern. Every application that accepts images needs to solve the same set of problems — upload reliability, format validation, virus scanning, EXIF stripping, retention policy, transformation for different display contexts, secure serving, and audit. Solving these problems N times across N applications produces N partial solutions, each with its own gaps and risks. Solving them once, well, in a shared service, produces a foundation the rest of the organization can build on.

The service is designed for Google Cloud Platform as the primary deployment target — using Google Cloud Storage (GCS) for object storage, Google Pub/Sub for event publishing, and Cloud Run for compute. The architecture is portable, with adapter implementations for AWS, Azure, and self-hosted alternatives, but GCP is the canonical case driving the design decisions.

The service is designed to be deployed as open source. While the canonical use case driving this specification is aircraft maintenance evidence in a SOX-regulated context, the design is deliberately generic — applicable to user-uploaded content in any domain where centralized governance, policy enforcement, and operational excellence matter.

## **1.2 The problem this addresses**

Across most large engineering organizations, the current state of image handling looks roughly the same:

* Each application that accepts uploads has built its own upload pipeline, often using slightly different libraries, conventions, and storage layouts.

* Validation is inconsistent. Some applications check MIME types from headers (easily spoofed); few inspect actual file bytes. Most accept whatever the client claims.

* Virus scanning is rare. Most applications store user uploads without ever running antivirus or malware checks against them.

* EXIF metadata is rarely stripped, leaking GPS coordinates, device identifiers, and other potentially sensitive metadata into stored files.

* Retention is informal. Most teams default to “keep everything forever,” which is both a cost problem and a compliance exposure for regulated data.

* Transformation pipelines are ad hoc or absent. Many applications serve original-resolution images for thumbnails, wasting CDN bandwidth at scale.

* There is no chain of custody for evidentiary images. When a regulator or investigator asks who uploaded a photo, when, from where, and what has happened to it since — the answer is often unavailable.

* There is no consistent way to handle deletion, legal hold, or controlled access across applications.

The cumulative cost is significant. Engineering time is spent rebuilding the same primitives. Storage and bandwidth costs grow without lifecycle management. Compliance posture is weak because it depends on each team independently doing the right thing. Security incidents become more likely because the controls are inconsistently applied.

## **1.3 Why a centralized service is the right answer**

The case for centralization rests on three observations:

**First, the concerns are genuinely cross-cutting.** Validation, virus scanning, EXIF handling, retention, transformation, and audit are not domain-specific. They apply identically whether the image is an aircraft inspection photo, a tool calibration certificate, a profile picture, or a marketing asset. Solving them in one place avoids re-solving them in each application.

**Second, compliance and audit demand consistency.** In a SOX-regulated context, and increasingly under aviation regulatory scrutiny (FAA, EASA, ANAC, DGAC), the question “how does this organization handle digital evidence” needs a coherent answer. A single service with explicit policies, versioned configuration, and complete audit trails provides that answer. A patchwork of per-application implementations does not.

**Third, the operational economics favor centralization.** A shared service means one place to monitor, one place to scale, one place to patch security vulnerabilities, one place to optimize CDN costs, and one place to apply lifecycle policies. The marginal cost of an additional consuming application drops sharply as the platform matures.

## **1.4 Why open source**

Building Lafken as a real open source project — not as an internal tool that happens to be on GitHub — has several rationales:

* It forces architectural discipline. A project intended for external use cannot bake in vendor-specific assumptions, organizational shortcuts, or undocumented dependencies.

* It enables ecosystem effects. Other organizations facing the same problems can contribute adapters, fixes, and features. The project benefits from external scrutiny and use cases.

* It signals engineering quality. A well-built OSS project in this space is a credibility marker for the team that builds it, useful for recruiting and external relationships.

* It avoids the “internal tool decay” trap. Internal-only projects often degrade as the originating team's priorities shift. Public projects with external users have a stronger forcing function for sustained quality.

## **1.5 What Lafken is not**

Scope clarity is essential for a project of this kind. Lafken is deliberately not several things:

**Not a static asset CDN.** Application chrome — logos, icons, illustrations bundled with the application — does not belong in Lafken. Those go in the application's own static hosting. Lafken is for content uploaded by users or systems on behalf of users, with business meaning, lifecycle, and policy implications.

**Not a generic file storage system.** Lafken is specifically for images. Other content types (videos, PDFs, generic documents) have different policy needs, different transformation requirements, and different audit profiles. Mixing them dilutes the design.

**Not a managed image service like Cloudinary.** Lafken is self-hosted. It does not include a built-in CDN, does not provide hosted storage, and does not offer per-image pricing. Operators run it on their own infrastructure with their own storage, CDN, and identity provider.

**Not a content moderation product.** Lafken provides hooks for moderation (a well-defined port, with adapters for common providers) but does not itself perform sophisticated moderation, build review tooling, or address adjacent concerns like CSAM detection (which requires specialized integrations with PhotoDNA or equivalent).

**Not an authorization system.** Lafken delegates all authorization decisions to a pluggable port. Default adapters cover simple cases; production deployments integrate with their organization's existing authorization infrastructure (OPA, OpenFGA, Cedar, custom HTTP services).

## **1.6 Summary of features**

Lafken provides:

**Direct-to-storage upload via signed URLs.** Clients upload bytes directly to GCS (or S3, or other configured storage backend) using time-limited, scope-bound signed URLs issued by the service. Image bytes never traverse the service itself, removing bandwidth and memory pressure from the application path.

**Resumable uploads for unreliable connections.** Support for tus protocol and GCS resumable uploads, enabling reliable upload from mobile devices and field environments with intermittent connectivity (the canonical case being aircraft mechanics uploading photos from tarmac WiFi).

**Namespaces with versioned policies.** Each consuming application or use case is represented as a namespace with explicit, versioned policy covering retention, allowed formats, file size limits, EXIF handling, virus scanning, content moderation, transformation rules, and serving mode. Policies are immutable; changes create new versions, with existing assets remaining governed by the policy version under which they were uploaded.

**Asynchronous validation and processing pipeline.** Every upload triggers a workflow: magic-byte detection, format validation, virus scanning, optional content moderation, optional EXIF extraction and stripping, optional re-encoding to canonical format, metadata extraction, content hashing. The workflow uses XState for in-process step orchestration with PostgreSQL-backed job claiming for durability across worker restarts.

**Per-namespace presets for serving.** Rather than allowing arbitrary transformation parameters at retrieval time, each namespace defines named presets (e.g., thumbnail, list\_view, detail\_main). Clients reference presets by name. This bounds the transformation space, makes CDN caching predictable, and enables governance review of how images are served.

**Three serving modes per namespace.** Public (predictable URLs, CDN-cacheable indefinitely, no per-request authorization), Signed (time-limited signed URLs with bucketed expiration for CDN cache compatibility), and Proxied (every request goes through the service for real-time authorization). Operators choose the mode that matches the sensitivity of each namespace.

**Pluggable adapters for storage, authorization, virus scanning, content moderation, identity, secrets, and event publishing.** The service core is hexagonal: domain logic does not depend on infrastructure. Operators select adapters that fit their environment without modifying the service.

**First-class client SDK.** Layered TypeScript SDK with a pure HTTP client at the base, a framework-agnostic upload manager built on Uppy in the middle, and a React layer with hooks and unstyled components on top. Supports non-React consumers, server-side integrations, and (eventually) other framework wrappers.

**Web administration console.** Operator UI for namespace management, asset search and inspection, quarantine review, audit log search, integration debugging, and webhook delivery monitoring. Acts as the primary configuration interface.

**Comprehensive audit and chain of custody.** Every state transition, access decision, configuration change, and administrative action is recorded to an append-only log. Designed for SOX-defensibility and aviation regulatory contexts. Supports legal hold workflows and evidentiary export.

## **1.7 Naming**

Lafken means “sea” in Mapudungun, the language of the Mapuche people of southern Chile and Argentina. The name evokes a vast, navigable expanse where many things are held and many routes converge — a metaphor loose enough to accommodate the service's future evolution but rooted enough to give the project a distinct identity. The Mapuche cultural reference is descriptive rather than ceremonial; the term refers to a geographic feature, not a sacred or politically charged concept.

# **2\. Goals and Non-Goals**

## **2.1 Goals**

1. Provide a single, well-designed service that handles image upload, processing, storage, and serving across many consuming applications.

2. Enforce consistent, auditable policy: validation, virus scanning, EXIF handling, retention, content moderation.

3. Optimize for Google Cloud Platform as the primary deployment target while remaining portable to other clouds and self-hosted environments.

4. Support direct-to-storage upload patterns to minimize service-side bandwidth and memory pressure.

5. Make resumable upload first-class for field/mobile use cases.

6. Provide a clean API contract where consuming applications store only an opaque asset identifier (UUID) and resolve URLs through the service.

7. Support both private and public assets through per-namespace serving modes, optimized for CDN caching.

8. Provide a layered TypeScript SDK that handles upload reliability, retry, progress, and post-upload polling.

9. Provide an operator console covering configuration, observability, and routine administrative workflows.

10. Maintain a complete chain of custody suitable for SOX-regulated and aviation-regulated contexts.

11. Ship as production-quality open source, deployable in any environment without cloud-vendor assumptions.

## **2.2 Non-goals**

12. Static application asset hosting (logos, icons, design system imagery) — these belong in application static hosting.

13. Generic file storage for non-image content (videos, PDFs, documents). Different content types have different requirements; conflating them dilutes the design.

14. Built-in CDN. Operators bring their own (Cloud CDN, CloudFront, Cloudflare, etc.).

15. Built-in image editing UI (cropping, annotation, drawing). These are application-level concerns.

16. Sophisticated content moderation review tooling. The service emits events and exposes APIs; review tooling can be built on top.

17. CSAM detection. This requires specialized integrations (PhotoDNA, NCMEC) with legal and operational complexity beyond the service's scope.

18. Identity management. The service authenticates via configurable OIDC providers and delegates authorization to a pluggable port.

19. Real-time collaboration features (shared review queues with locking, comments, @mentions).

20. Multi-tenancy beyond namespaces. Operators who need hard isolation run multiple instances.

# **3\. Architecture Overview**

## **3.1 Hexagonal architecture**

Lafken follows a hexagonal (ports-and-adapters) architecture. The domain core contains the pure logic: asset lifecycle, policy evaluation, namespace and preset semantics, state transitions, retention rules. The core defines ports (interfaces) for everything that touches infrastructure. Adapters implement those ports against specific technologies.

This separation makes the service genuinely portable across environments and ensures that adopting different technologies (a different storage backend, a different authorization system) requires writing or selecting an adapter, not modifying core logic. It also makes the core testable in isolation, without standing up infrastructure.

## **3.2 Ports defined by the core**

**StoragePort.** Upload URL generation (resumable and simple), object existence checks, object metadata, object reading, object deletion. Implementation: GCS (the only adapter shipped for v1.0). Additional adapters (S3, local filesystem) are deferred to a future major version.

**MetadataRepositoryPort.** Persistence and querying of asset records, namespaces, policies, presets, upload intents, processing jobs, state transitions, configuration audit log. Implementation: PostgreSQL 18+.

**AuthorizationPort.** Boolean check: can principal X perform action Y on resource Z? Implementations: allow-all (the only adapter shipped for v1.0). Additional adapters (file-based RBAC, OIDC-claims-based, HTTP webhook) are deferred to a future major version.

**IdentityPort / OIDC integration.** Authentication of API requests via configurable OIDC issuer. Provider-agnostic; works with Microsoft Entra, Google Identity, Keycloak, Authentik, Auth0, Okta, etc.

**VirusScanPort.** Scan an object, return clean/infected/error. Implementations: ClamAV in production; a deterministic local stub for development and tests. Additional adapters (no-op, external webhook) are deferred to a future major version.

**ContentAnalysisPort.** Generalized analyzer chain producing structured findings (initially used for content moderation, generalizable to face detection, perceptual hashing, etc.). Implementation: a deterministic local stub for v1.0. Additional adapters (Cloud Vision SafeSearch, Rekognition, generic webhook) are deferred to a future major version.

**TransformerPort.** Given source location and transformation parameters, produce a signed serving URL. Implementation: imgproxy (the only adapter shipped for v1.0). The `imagor` adapter is deferred to a future major version.

## **3.3 Workflow architecture**

The async processing pipeline is implemented using XState for in-process state machine orchestration, combined with a PostgreSQL-backed job claim table for durability across worker restarts. This is a deliberate departure from heavyweight durable workflow engines, motivated by the actual shape of the work:

* Workflows are short — typically 5–30 seconds end-to-end.

* Step-level timeouts are in seconds (10s for magic-byte detection, 30s for sharp metadata, 60s for virus scan).

* The structure is simple: sequential validation, then parallel scan/moderation/re-encoding, then finalize.

* The durability requirement is straightforward: don't lose track of an asset that's mid-processing if a worker dies.

XState handles the in-process logic — step orchestration, parallel state coordination, timeouts, transient retry with exponential backoff, error classification. PostgreSQL holds a processing\_jobs table where workers claim work with heartbeat-based lease semantics; a sweeper reclaims jobs whose workers have died. This combination provides the right durability for the workflow shape without the overhead of a dedicated workflow engine.

## **3.4 Reference deployment topology on GCP**

A typical production deployment on Google Cloud Platform looks like:

* Lafken service running on Cloud Run, autoscaled based on request load.

* PostgreSQL 13+ on Cloud SQL as the metadata database.

* GCS as the bytes-of-record storage.

* imgproxy running on Cloud Run as a separate service for transformation and serving.

* Cloud CDN in front of imgproxy for cached serving.

* ClamAV running on Cloud Run (or GKE) for virus scanning. May be replaced or supplemented with cloud-native scanning.

* Google Pub/Sub for lifecycle event publishing to consuming systems.

* Microsoft Entra (or Google Identity) as the OIDC provider for authentication.

* Authorization service (Condor, OPA, OpenFGA, or similar) reachable via the AuthorizationPort webhook adapter.

* GCP Secret Manager for runtime secrets (storage credentials, signing keys, OIDC client secrets).

* Cloud Logging and Cloud Monitoring for observability.

For development and small deployments, the reference Docker Compose setup combines all of the above into a single self-contained stack: PostgreSQL, MinIO (S3-compatible storage for local dev — there isn't a comparable local GCS emulator), imgproxy, ClamAV, the Lafken service, and a simple OIDC provider. This enables a developer to clone the repository and have a working system in under five minutes, with no cloud accounts required.

## **3.5 Hard dependencies**

* PostgreSQL 13 or later. Required for the metadata store and processing job claim table. The schema uses only broadly-supported features; specific adapters or operational tooling may benefit from newer versions but are not required.

* imgproxy. Required for image transformation and serving. Other transformers (imagor) may be supported via adapters in the future.

* Node.js runtime supporting Node-API v9 (≥18.17.0 or ≥20.3.0). Required by the sharp library for image metadata and processing.

# **4\. Data Model**

## **4.1 Identifier strategy**

Lafken uses a dual-identifier scheme for assets: a UUIDv7 internal identifier and a UUIDv4 external identifier. Every other table uses UUIDv7 as its primary key as well.

**Internal identifier (UUIDv7).** Used as the primary key for every table and across internal joins. UUIDv7 (RFC 9562) embeds a millisecond timestamp prefix, so generated IDs are roughly k-sortable by creation time and preserve the index locality that makes B-tree inserts cheap, while remaining globally unique without a coordinator. Every Lafken migration uses `uuid PRIMARY KEY DEFAULT uuidv7()` (PostgreSQL 18 native function) per `CLAUDE.md`. `gen_random_uuid()` (UUIDv4) is forbidden as a primary key default.

**External identifier / public\_id (UUIDv4).** Used in API responses, signed URLs, client storage, and any context where the identifier crosses the service boundary. UUIDv4 has 122 bits of entropy and reveals no information about creation time, rate, or volume — the right property for an identifier that may appear in URLs, logs, browser history, embedded HTML, and shared messages. Only the `assets` and `upload_intents` tables carry a `public_id` column, populated via `gen_random_uuid()`. The public\_id is not a security mechanism (authorization remains the security boundary), but its unguessability provides defense-in-depth against enumeration attacks if other defenses fail.

**Non-leakage rule.** Internal UUIDv7 IDs must never appear in API responses, signed URLs, error messages displayed to users, or logs routed to third-party destinations. The architectural separation between internal id and public\_id is what keeps creation-time information (the millisecond timestamp embedded in UUIDv7) from leaking externally; an attacker who could observe a stream of internal IDs could otherwise reconstruct upload volume and rate. Code review and integration tests enforce this separation.

Some entities have only an internal identifier and no public\_id, because they are referenced externally by a different durable handle:

* Namespaces are referenced externally by their slug (e.g., 'aircraft-photos'). The slug is the durable external reference; the internal id is implementation detail.

* Presets are referenced externally by their name within a namespace. Same reasoning.

* Storage bindings, namespace\_policies, asset\_state\_transitions, asset\_analyses, processing\_jobs, and the configuration audit log are entirely internal and have no external identifier.

## **4.2 Core tables**

### **namespaces**

A namespace represents a logical grouping of assets that share policy and storage configuration. Each consuming application or use case typically has its own namespace (or several).

namespaces (  id                  uuid primary key default uuidv7(),  slug                text not null unique,    \-- 'aircraft-photos', 'tool-calibration'  display\_name        text not null,  description         text,  current\_policy\_id   uuid not null,           \-- FK to namespace\_policies  storage\_binding\_id  uuid not null,           \-- FK to storage\_bindings  created\_at          timestamptz not null,  updated\_at          timestamptz not null,  archived\_at         timestamptz              \-- soft archive)

The slug is immutable once assigned (renaming a namespace would break every application referencing it). Archived namespaces continue to serve existing assets but reject new uploads.

### **namespace\_policies**

A namespace policy is the versioned, immutable declaration of how assets in a namespace are validated, stored, processed, and served. Policy changes never modify existing rows; they create new versions and update the namespace's current\_policy\_id pointer.

namespace\_policies (  id                       uuid primary key default uuidv7(),  namespace\_id             uuid not null,  version                  integer not null,  retention\_days           integer,            \-- null \= indefinite  retention\_mode           text not null,      \-- 'delete' | 'archive' | 'none'  max\_file\_size\_bytes      bigint not null,  allowed\_mime\_types       text\[\] not null,  exif\_handling            text not null,      \-- legacy column; UI surfaces are dropped in v1.0 (see §1.2 of the v1.0 re-baseline)  virus\_scan\_required      boolean not null,  content\_moderation       jsonb,              \-- provider, thresholds, decision rules  required\_metadata\_schema jsonb,              \-- JSON Schema for custom\_metadata  immutable                boolean not null,  serving\_mode             text not null,      \-- only 'signed' is honored at runtime in v1.0; column kept for forward compat  signed\_url\_ttl\_seconds   integer,            \-- when serving\_mode \= 'signed'  signed\_url\_bucket\_size   integer,            \-- bucketing for cache friendliness  retry\_config             jsonb,              \-- per-step retry budgets  created\_at               timestamptz not null,  created\_by               text,  unique (namespace\_id, version))

Each asset records the policy version under which it was uploaded. Subsequent policy changes do not retroactively apply to existing assets — this is essential for SOX-defensible behavior. Retention math uses the asset's policy\_version\_id, not the namespace's current policy.

### **namespace\_presets**

Presets are named transformation configurations. Clients reference presets by name when requesting URLs (e.g., preset=thumbnail, preset=detail\_main), and the service translates the preset into transformer parameters when generating the serving URL.

namespace\_presets (  id                    uuid primary key default uuidv7(),  namespace\_id          uuid not null,  name                  text not null,  version               integer not null,  transformation        jsonb not null,        \-- imgproxy params: width, height, fit, format, quality, dpr  cdn\_max\_age           integer,  signed\_url\_ttl        integer,               \-- override namespace default  pre\_generate          boolean not null default false, \-- legacy column; pre-generation is dropped in v1.0 (see §1.2)  required\_permission   text,                  \-- additional auth check beyond namespace access  description           text,  active                boolean not null default true,  created\_at            timestamptz not null,  created\_by             text,  unique (namespace\_id, name, version))

### **storage\_bindings**

Storage bindings represent configured backends. Multiple namespaces can share a binding, and a namespace can be migrated between bindings without rewriting policy.

storage\_bindings (  id              uuid primary key default uuidv7(),  name            text not null unique,  adapter\_type    text not null,             \-- 'gcs' is the only value emitted in v1.0  config          jsonb not null,            \-- bucket, region, prefix, etc.  encrypted\_creds text,                      \-- secret reference, never raw  created\_at      timestamptz not null)

### **assets**

The central record for an uploaded image. Combines client-supplied metadata, server-derived metadata, policy version reference, and lifecycle state.

assets (  id                          uuid primary key default uuidv7(),  \-- internal, never exposed externally  public\_id                   uuid not null unique default gen\_random\_uuid(), \-- UUIDv4, the external identifier  namespace\_id                uuid not null,  policy\_version\_id           uuid not null,  state                       text not null,  storage\_binding\_id          uuid not null,  storage\_key                 text not null,               \-- path within binding  content\_hash                bytea,                       \-- SHA-256  size\_bytes                  bigint,  mime\_type                   text,                        \-- server-detected  declared\_mime\_type          text,                        \-- client-claimed  width                       integer,  height                      integer,  uploaded\_by                 text,  owning\_record\_type          text,                        \-- e.g. 'work\_order'  owning\_record\_id            text,  custom\_metadata             jsonb not null default '{}',  capture\_context             jsonb,                       \-- structured field-capture data  client\_overrides            jsonb not null default '{}',  effective\_max\_size\_bytes    bigint not null,  effective\_expires\_at        timestamptz,  effective\_url\_ttl           integer not null,  legal\_hold                  boolean not null default false,  legal\_hold\_reference        text,  state\_reason                text,                        \-- detail on terminal states  created\_at                  timestamptz not null,  confirmed\_at                timestamptz,  state\_changed\_at            timestamptz not null,  deleted\_at                  timestamptz)

Effective values (effective\_max\_size\_bytes, effective\_expires\_at, effective\_url\_ttl) are denormalized from the policy at confirmation time, accounting for any client overrides that strengthen — but never weaken — the policy's defaults. This denormalization makes retention sweeps and other operational queries efficient and unambiguous.

### **Asset state machine**

Possible states:

* *pending* — upload intent created, awaiting client upload.

* *uploaded* — client called confirm; processing job not yet claimed by a worker.

* *processing* — XState machine is running validation, scanning, transformation. May include in-flight retries; the asset stays in this state across all retry attempts until either success or all retries exhausted.

* *ready* — available for retrieval.

* *rejected* — failed deterministic validation (bad format, wrong MIME, invalid image, dimensions exceeded). Not retryable.

* *quarantined\_virus* — virus scan returned an infected result. Bytes typically deleted or moved to quarantine storage.

* *quarantined\_moderation* — content moderation flagged above policy threshold. Bytes retained for review.

* *processing\_failed* — workflow could not complete despite retries. Distinct from quarantine: 'we couldn't finish checking' rather than 'we checked and it failed'. Recoverable via manual or automatic retry.

* *expired* — past retention, awaiting hard delete or already archived.

* *deleted* — soft-deleted, possibly subject to retention before hard-delete.

### **upload\_intents**

Upload intents represent the contract between the service and a client preparing to upload. Held in their own table to keep abandoned intents (which are common — clients open forms and never submit) from polluting the assets table.

upload\_intents (  id                       uuid primary key default uuidv7(),  public\_id                uuid not null unique default gen\_random\_uuid(),     \-- pre-allocated, becomes asset.public\_id on confirm  namespace\_id             uuid not null,  policy\_version\_id        uuid not null,  storage\_binding\_id       uuid not null,  storage\_key              text not null,  declared\_mime\_type       text,  declared\_size\_bytes      bigint,  declared\_content\_hash    bytea,  upload\_url               text not null,  upload\_url\_expires\_at    timestamptz not null,  created\_by               text,  created\_at               timestamptz not null,  consumed\_at              timestamptz,  expired\_at               timestamptz)

### **processing\_jobs**

The job claim table. One row per asset that needs processing. Workers claim jobs with heartbeat-based lease semantics; a sweeper reclaims jobs whose workers have died. Long retry waits release the job back to the queue with a not-before timestamp.

processing\_jobs (  asset\_id          uuid primary key,           \-- FK to assets.id  worker\_id         text,                       \-- who currently holds the lease  state             text not null,              \-- 'claimed' | 'released' | 'completed'  claimed\_at        timestamptz,  heartbeat\_at      timestamptz,                \-- updated periodically by the worker  current\_step      text,                       \-- 'virus\_scan', 'magic\_byte\_detection', etc.  attempt\_number    integer not null default 1, \-- across all retries  not\_before        timestamptz,                \-- earliest re-claim time (for backoff)  last\_error        text,  last\_error\_at     timestamptz,  created\_at        timestamptz not null)

### **asset\_state\_transitions**

Append-only audit trail for every asset state change. Required for SOX-defensibility and indispensable for debugging stuck assets.

asset\_state\_transitions (  id              uuid primary key default uuidv7(),  asset\_id        uuid not null,  from\_state      text,  to\_state        text not null,  reason          text,  metadata        jsonb,  occurred\_at     timestamptz not null,  occurred\_by     text                        \-- principal id or 'system' or 'worker:\<id\>')

### **asset\_analyses**

Generalized analyzer findings (virus scan, content moderation, EXIF extraction, future analyzers). Replaces what would otherwise be a proliferation of single-purpose tables. Also serves as a cache for expensive external calls — keyed by content hash to avoid re-billing on retries.

asset\_analyses (  id                  uuid primary key default uuidv7(),  asset\_id            uuid not null,  analyzer            text not null,           \-- 'clamav', 'image\_inspection', 'content\_moderation\_local'  analyzer\_version    text,  findings            jsonb not null,  decision            text,                    \-- 'pass' | 'flag' | 'quarantine' | 'error'  occurred\_at         timestamptz not null)

### **Configuration audit log**

Every change to a namespace, policy, preset, or storage binding produces a row in a separate configuration\_audit\_log table. This is distinct from asset\_state\_transitions and serves a different audience (compliance and platform team operators rather than asset-level investigators).

# **5\. Upload Flow**

## **5.1 Direct-to-storage pattern**

Image bytes never traverse the Lafken service. Clients upload directly to GCS (or the configured storage backend) using time-limited, scope-bound signed URLs that the service issues. This pattern has several important consequences:

* The service does not become a bandwidth bottleneck. A 20 MB aircraft photo never passes through Lafken's process memory or network interfaces.

* Resumable uploads work cleanly because the storage backend handles them natively (GCS resumable uploads, tus protocol).

* The signed URL is a cryptographic capability, scoped to a specific path. Clients cannot redirect uploads to a different storage location, cannot upload arbitrary content types, and cannot exceed declared size limits.

* Server-side verification (size, MIME type from magic bytes, content hash) happens after the upload completes, not inline in the request path.

## **5.2 Sequence**

21. Client requests an upload intent: POST /assets/upload-intents with namespace, declared MIME type, declared size, optional custom metadata, optional owning record reference.

22. Service validates the request against the namespace policy (allowed MIME types, max size, required metadata schema). Service runs the AuthorizationPort: can this principal upload to this namespace? to this owning record?

23. If validation passes, service generates a public\_id and internal id, computes the storage key, generates a signed GCS URL via the StoragePort, persists the upload intent, returns { public\_id, upload\_url, upload\_headers, expires\_at } to the client.

24. Client uploads bytes directly to GCS using the signed URL. GCS rejects invalid uploads (wrong path, exceeded size, wrong content-type if constrained in the URL signature).

25. Client calls POST /assets/{public\_id}/confirm. Service performs an existence check on the storage object to verify bytes exist at the expected path. In the same database transaction, the service: marks the upload intent consumed, inserts an asset row in state 'uploaded', inserts a processing\_jobs row in state 'released' with not\_before \= now(), commits.

26. A worker polls the processing\_jobs table, claims the job (state → 'claimed', worker\_id and heartbeat\_at populated), and starts the XState machine. Asset state transitions from 'uploaded' to 'processing'.

27. XState machine runs validation, scanning, moderation, and finalization (see Section 6). State transitions through processing → ready (or terminal failure state).

28. Client polls GET /assets/{public\_id} or receives a webhook (per namespace configuration) when the asset reaches a terminal state.

## **5.3 Resumable upload**

For large files or unreliable connections, the upload intent endpoint can issue a tus-compatible upload URL or a GCS resumable upload session URI. The client SDK (built on Uppy) selects the appropriate protocol based on file size and namespace configuration. Uploads survive network interruptions, browser closes, and device sleep — important for the field-mechanic-on-tarmac case driving much of this design.

Upload intents have generous TTL (default 24 hours) to support offline-capture scenarios where the client may queue uploads before connectivity returns.

## **5.4 Confirm and validation**

The confirm endpoint is the trigger for the async pipeline. It does not wait for processing to complete; it acknowledges the upload, inserts a processing\_jobs row, and returns quickly so the client can move on. A worker picks up the job from the table within milliseconds (poll interval is configurable; default 1 second) and begins processing.

Confirm is idempotent. A retry from a client that did not receive the response will not create duplicate asset rows. The upload intent's consumed\_at field acts as the dedup key.

## **5.5 Orphan upload handling**

Upload intents that expire without being consumed (client uploaded but never confirmed, or client abandoned the flow) are swept periodically. Default behavior: delete the bytes from storage if present, delete the intent record. Operators can opt into auto-confirm behavior for namespaces where lost confirms are common, but this adds ambiguity to the audit trail and is not the default.

# **6\. Asynchronous Processing Pipeline**

## **6.1 Architecture: XState \+ Postgres claim-table**

The pipeline is implemented as an XState machine that runs in-process within a worker. State machine logic — step orchestration, parallel coordination, transient retry timing, error classification — lives entirely in XState. Durability across worker restarts is provided by a separate mechanism: the processing\_jobs table in PostgreSQL, where workers claim jobs with heartbeat-based lease semantics.

This split keeps each tool doing what it does well. XState handles the seconds-level timing and decision logic that workflow engines are awkward at. PostgreSQL handles the durability that pure in-memory state can't provide. Together they cover the full requirement without the overhead of a dedicated workflow engine.

## **6.2 Workflow shape**

The XState machine implements the high-level shape:

29. Magic-byte detection (sequential, fast-fail)

30. Format validation and metadata extraction (sequential)

31. Parallel: virus scan, content moderation, optional re-encoding

32. Finalize: hash, update asset record, transition to 'ready', emit Pub/Sub event

Within each step, sub-states handle invocation, success, and retry-on-error. The XState machine is declarative — the full shape, including parallel coordination, is expressed in the state machine definition rather than scattered across imperative code.

## **6.3 Step-by-step**

### **Step 1 — Magic-byte detection**

Stream the first 64 KB from GCS. Run the file-type library to detect the actual MIME type from binary signatures, ignoring whatever the client claimed. If detection fails entirely, transition to 'rejected' with reason 'unrecognized\_format'. If detection succeeds but the result is not in the namespace's allowedMimeTypes, transition to 'rejected' with reason 'mime\_type\_not\_allowed'. If the detected type differs from the declared type, log the discrepancy in asset\_state\_transitions but proceed (the discrepancy itself is not necessarily malicious — clients sometimes declare incorrectly).

### **Step 2 — Format validation and metadata extraction**

Download the full object (or stream it through processing). Pass it to sharp's metadata() method. If sharp throws, the file is structurally invalid as an image even if its magic bytes were correct: transition to 'rejected' with reason 'invalid\_image\_format'. Extract width, height, format, channels, alpha, color profile presence, EXIF presence.

Cross-check sharp's detected format against the file-type result. Disagreement is suspicious: transition to 'rejected' with reason 'format\_inconsistency'.

If the namespace policy declares requireExifExtraction, run exifr to parse EXIF data. Populate capture\_context.location, capture\_context.captured\_at, capture\_context.device — making them queryable structured data while removing them from the image bytes (the latter happens in Step 5 if re-encoding is enabled, or via a dedicated EXIF strip step otherwise).

### **Step 3 — Virus scan (parallel)**

Stream the object through the configured VirusScanPort. Clean → step succeeds. Infected → transition to 'quarantined\_virus', delete or move bytes per policy. Scanner errors trigger the retry logic described in Section 6.5.

### **Step 4 — Content moderation (parallel, conditional)**

If the namespace policy enables content moderation, send the asset to the configured provider (Cloud Vision SafeSearch by default; Rekognition or webhook adapters available). Findings are recorded in asset\_analyses regardless of decision. The decision rule (per policy) determines whether to quarantine, mark-and-allow, or reject.

### **Step 5 — Optional re-encoding (parallel, conditional)**

If the namespace policy declares reEncodeOnUpload, run the asset through sharp with: rotate to honor EXIF orientation, strip all metadata, encode to the canonical format declared by policy (JPEG with mozjpeg quality 90 by default; AVIF, WebP, etc., per policy).

Re-encoding gives the storage layer a clean, predictable file with no embedded metadata leaks. The original may be retained in a parallel storage path if policy.preserveOriginal is true, otherwise the canonical version replaces it.

### **Step 6 — Finalize**

Compute the SHA-256 content hash. Update the asset record with all derived metadata. Transition state from 'processing' to 'ready' using a database update with a state precondition for idempotency. Mark the processing\_jobs row as 'completed'. Emit an asset.ready event via the EventPublisherPort (Google Pub/Sub by default).

## **6.4 Failure taxonomy**

Failures are not all the same; the right response depends on the failure mode. Five categories with distinct handling:

**Deterministic processing failures.** The asset is structurally invalid: wrong format, exceeded dimensions, MIME type not allowed, sharp can't parse it. Running the same step again on the same bytes produces the same result. These resolve to 'rejected' state immediately. Bytes are typically deleted (per policy).

**External provider terminal results.** Virus scan returned 'infected'. Content moderation returned 'above threshold'. The system worked correctly; the result is bad. These resolve to 'quarantined\_virus' or 'quarantined\_moderation' immediately. Distinct from rejection because the asset might be a valid image but contains something requiring human review.

**External provider errors.** ClamAV unreachable, Cloud Vision returned 503, moderation webhook timed out. The system did not work; we don't know if the asset is good or bad. Retryable per Section 6.5.

**Internal infrastructure failures.** Storage timeout, database briefly unavailable, network blip, worker memory pressure. Same retry treatment as external provider errors.

**Catastrophic worker failure.** Worker process died (OOM, container restart, node failure, deployment rolling). Work was in progress and now isn't. Recovered via the heartbeat-and-sweep mechanism in Section 6.6.

## **6.5 Retry logic for transient failures**

Transient failures — provider errors, infrastructure failures — are retried using a two-tier strategy. Short retries happen in-memory within the XState machine; longer retries release the job back to the claim table for later re-claim by any worker.

### **In-memory retries (short delays)**

For sub-second to a-few-seconds delays — typically the first three retry attempts with backoff of 1s, 5s, 15s — the worker stays in-memory in an XState 'retrying' substate. The state machine waits for the timer and re-invokes the failed step. Postgres is unaware; from its perspective the worker is heartbeating normally.

This is appropriate for short delays because the worker isn't doing anything else useful while waiting. A worker holding one job for a cumulative 21 seconds of retry waits is not a meaningful resource problem.

### **Released-with-backoff retries (long delays)**

After in-memory retries exhaust (cumulative wait around 30 seconds), the worker releases the job back to the claim table with a not\_before timestamp:

33. Worker records the failure in the asset's audit trail (state stays 'processing' — we haven't given up yet).

34. Worker updates processing\_jobs: state \= 'released', not\_before \= now() \+ backoff, last\_error \= '...', increments attempt\_number, releases the claim.

35. Worker returns to the pool to pick up other work.

36. After the backoff elapses, a worker (the same one or a different one) re-claims the job. The XState machine starts fresh, but attempt\_number is preserved. The asset's current state column and the processing\_jobs.current\_step field tell the new worker where to resume.

Backoff progression beyond the in-memory retries: 1 minute, 5 minutes, 30 minutes. After the configured maximum attempts (default 7 total across in-memory and released), the asset transitions to 'processing\_failed'.

### **Jitter**

Pure exponential backoff is wrong in production. If a hundred assets fail simultaneously (e.g., the moderation API briefly went down), they all retry on the same schedule and re-overwhelm the recovering service. Lafken adds jitter to all retry delays:

actual\_delay \= base\_delay \* 0.5 \+ random(0, base\_delay \* 0.5)

This produces delays uniformly distributed between 50% and 100% of the nominal value, spreading retries across time and avoiding thundering-herd patterns.

### **Transient vs. permanent classification**

Retry logic only applies to transient failures. The XState machine classifies errors:

* Transient: network errors (timeout, ECONNREFUSED, ECONNRESET, EAI\_AGAIN), HTTP 5xx, HTTP 429 (rate limit), database deadlocks, unknown errors (default to transient with small budget).

* Permanent: HTTP 4xx other than 429 (400 means our request is malformed; 401/403 means auth issue; 404 means the resource doesn't exist), database constraint violations (logic bug; retry won't help).

Permanent classification is conservative — better to retry a permanent failure 3 times than to give up on a transient one — but distinguishes cases that fundamentally cannot be fixed by retry.

### **Respecting Retry-After**

When external services return rate-limit (HTTP 429\) or service-unavailable (HTTP 503\) responses with a Retry-After header, the retry logic honors the header rather than using its standard backoff. If the header indicates a delay longer than the in-memory retry budget would have used, the worker releases the job with not\_before \= now() \+ retry\_after rather than busy-waiting.

### **Per-step retry budgets**

Retries are tracked per step, not per workflow. The virus scan step has its own budget; the moderation step has its own. A workflow could plausibly need to retry virus scan 3 times and moderation 2 times in the same run. The whole-workflow timeout (default 10–15 minutes) provides the upper bound on cumulative time across all retries.

## **6.6 Recovery from worker death**

The Postgres claim table is the durability mechanism. When a worker claims a job, it heartbeats the row every 10 seconds (configurable). If the worker dies, heartbeats stop.

A separate sweeper process — running on a schedule, every 30 seconds by default — finds jobs whose heartbeat\_at is older than a threshold (default 60 seconds: long enough to tolerate transient pauses, short enough to recover quickly):

37. Verify the job is genuinely abandoned. Check the asset's current state; if it has moved past 'processing', the previous worker finished but didn't clean up. Mark the job 'completed' and move on.

38. If still stuck, increment attempt\_number, mark the job state as 'released', clear worker\_id and heartbeat\_at. The job becomes available for re-claim.

39. After the configured max attempts, transition the asset to 'processing\_failed' and stop retrying.

The XState machine's internal state isn't directly persisted — that would couple durability too tightly to the state machine. Instead, the asset's state column and the processing\_jobs.current\_step field are enough for a new worker to figure out where to resume:

* state \= 'uploaded' → start the workflow from the beginning.

* state \= 'processing', current\_step \= 'virus\_scan' → check asset\_analyses; if scan completed, move to next step; if not, redo it.

This is checkpoint-after-each-meaningful-sub-step rather than full state-machine persistence. Simpler, and good enough because the steps themselves are idempotent.

## **6.7 Idempotency**

Resumption only works if every step is idempotent. The pipeline is designed for this:

* Magic-byte detection and sharp metadata are pure reads of immutable bytes. Naturally idempotent.

* Virus scan: the scan call is idempotent at the scanner level. Storing the result uses upsert keyed on (asset\_id, analyzer).

* Content moderation: same as virus scan, with content-hash-based caching to avoid re-billing for the same image on retry.

* Re-encoding: writes to a deterministic storage path. Re-running overwrites with identical bytes.

* Finalize: the state transition uses UPDATE assets SET state='ready' WHERE id=$1 AND state='processing'. If the state is already 'ready', the update affects zero rows and the step succeeds.

## **6.8 Concurrency control**

The claim query uses PostgreSQL's FOR UPDATE SKIP LOCKED to allow multiple workers to poll without contention:

SELECT \* FROM processing\_jobs WHERE state \= 'released'   AND (not\_before IS NULL OR not\_before \<= now())ORDER BY not\_before NULLS FIRST, created\_atFOR UPDATE SKIP LOCKEDLIMIT 1

Result writes use optimistic concurrency. The worker's update includes a precondition on worker\_id: if the row's worker\_id no longer matches (because the sweeper preempted it), the update affects zero rows and the original worker silently abandons its work. The new worker will redo it.

## **6.9 Whole-workflow timeout**

Beyond per-step timeouts, a whole-workflow timeout guards against pathological cases — a virus scanner running but extremely slowly, a moderation API stuck in long retry loops, an internal bug. Default 10–15 minutes; configurable per namespace. After this timeout, the asset transitions to 'processing\_failed' regardless of which step it's in.

## **6.10 What the calling application sees**

From the consuming application's perspective, the asset stays in 'processing' state across all retries. Only when retries are fully exhausted does it transition to 'processing\_failed'. This is honest — the system hasn't given up yet, the asset isn't done yet — and avoids exposing internal mechanics that applications don't need to know about.

Calling applications can poll GET /assets/{id} or subscribe to webhook events for terminal state transitions. The state\_reason field on the asset record provides specific cause: 'virus\_detected', 'content\_flagged\_adult', 'moderation\_provider\_unavailable', 'format\_inconsistency', etc. The calling application can render appropriate user-facing messages based on these reasons.

## **6.11 Recovery from processing\_failed**

Once an asset is in 'processing\_failed', recovery is still possible:

* **Manual operator retry.** Admin console exposes a 'retry processing' action. The operator inspects the failure history and decides whether the underlying issue has been resolved. Retry restarts the workflow from the beginning.

* **Automatic sweeper.** Operator-enabled feature: a periodic job finds 'processing\_failed' assets older than a threshold and reattempts processing if the recent failure rate is below an alert level. Off by default — automatic retries on systemic infrastructure issues create cascading load.

* **Eventual cleanup.** If 'processing\_failed' assets accumulate without resolution, retention applies via effective\_expires\_at. The calling application sees its asset never reached 'ready' and can resubmit.

## **6.12 Limits of recovery**

The architecture provides operational resilience for the kind of failures that actually happen: worker death, transient provider failures, infrastructure blips, network jitter. It does not provide catastrophic-loss protection — if the PostgreSQL database is destroyed and there is no backup, the asset records and processing job records are lost even though the bytes may remain in GCS. Recovery from catastrophic loss depends on operator practices around backup, replication, and disaster recovery, which are operator responsibilities.

# **7\. Serving and Presets**

## **7.1 Serving modes**

Each namespace declares one of three serving modes:

### **Public mode**

URLs are predictable and constructable by the client without contacting the service:

https://images.example.com/\<asset\_public\_id\>/\<preset\_name\>

No per-request authorization, no signing, no TTL. Cloud CDN caches indefinitely with the URL as the key. Possession of the URL implies authorization. This is appropriate for the majority of content where the application performs view authorization at its own layer and the asset service simply serves bytes to anyone with the link.

Most namespaces should use public mode. It produces the best CDN cache behavior, the simplest client experience, and the lowest service load.

### **Signed mode**

URLs are signed with HMAC and have a TTL. Each retrieval request to the asset service triggers an authorization check; only authorized requests receive a fresh URL.

Critical implementation detail: expiration timestamps are bucketed (default 15-minute granularity) rather than using exact now()+ttl. Without bucketing, every issued URL has a unique signature, which destroys CDN cache hit ratio. With bucketing, all URLs issued within a bucket share a cache key. The actual validity window ranges from ttl to ttl+bucket\_size; the bucket size should be a small fraction of the TTL (typically ttl/4).

Use signed mode for namespaces where view-time authorization actually matters: accident investigation evidence, HR-related content, content under legal hold.

### **Proxied mode**

Every image request goes through the Lafken service, which performs real-time authorization and forwards to the transformer. Highest cost (image bytes traverse the service), highest authorization fidelity (revocation is immediate). Reserved for content where neither public nor signed mode provides sufficient guarantee — e.g., active investigations where access can change minute-to-minute.

## **7.2 Presets**

Presets are the unit of serving configuration. Each namespace defines named presets (thumbnail, list\_view, detail\_main, etc.). Clients reference presets by name; the service translates the preset name into transformer parameters.

Why presets rather than free-form transformation parameters in URLs:

* Bounded transformation space. Apps cannot accidentally request a 50000×50000 AVIF that DOSes the transformer.

* Predictable CDN cache. With M assets and N presets, there are M×N possible cache entries — bounded and analyzable. Free-form parameters produce effectively infinite cache fragmentation.

* Pre-generation viability. Known preset configurations can be pre-generated at upload time and stored as derivatives in GCS, eliminating cold-cache latency for hot paths.

* Governance. The set of how images can be served is reviewable, auditable, and versionable.

* Better debugging. "This list view is slow" maps to "the list\_view preset has too-aggressive parameters" rather than "some app is requesting a weird transformation."

## **7.3 imgproxy as the transformer**

The default and recommended transformer is imgproxy. The asset service does not modify imgproxy or fork it; imgproxy receives a fully-resolved URL with all parameters baked in and a valid HMAC signature. Imgproxy is unaware of presets, namespaces, or any Lafken concept.

The service translates preset name into imgproxy URL parameters at URL-issue time (signed mode) or at request-handling time (proxied mode). Imgproxy fetches source bytes from GCS and returns the transformed image, which Cloud CDN caches.

## **7.4 Preset versioning**

Presets are versioned. Changing a preset's parameters creates a new version. URLs constructed with the new version reach imgproxy with the new parameters; URLs already cached at the CDN under the old version remain valid until cache expiration. This is a soft transition — appropriate for most preset changes (quality adjustments, format additions). For changes that require immediate effect, operators can issue Cloud CDN purges, but this should be rare.

## **7.5 Pre-generation**

Presets marked pre\_generate: true cause the async pipeline to additionally generate derivatives at upload time, storing them at deterministic paths in GCS. Subsequent requests for those presets hit pre-generated derivatives instead of going through imgproxy on-demand.

This is appropriate for hot paths (the thumbnail used in every list view; the standard detail-view size). It costs storage but eliminates imgproxy compute on read paths and improves first-request latency. Operators can monitor preset hit rates and adjust pre-generation accordingly.

# **8\. Authorization and Identity**

## **8.1 Identity**

Lafken authenticates API requests via OIDC. Operators configure an OIDC issuer URL and the principal claim to extract (sub, email, preferred\_username, or custom). The service validates tokens, extracts the principal, and passes it to the AuthorizationPort for every authorization decision. Microsoft Entra is the canonical OIDC provider for LATAM deployments; Google Identity, Keycloak, Authentik, Auth0, and Okta are also supported.

For development, a header-based authentication mode (X-Principal: alice@example.com) is supported but refuses to run when LAFKEN\_ENV=production. This makes local development frictionless without compromising production security.

## **8.2 Authorization model**

The AuthorizationPort interface is intentionally minimal:

interface AuthorizationPort {  can(principal: Principal, action: Action, resource: Resource): Promise\<boolean\>;}

Lafken does not impose a permission model. Adapters implement whatever model fits the deployment: RBAC, ABAC, ReBAC, OPA policies, OpenFGA relations, custom HTTP services.

Default adapters shipped:

* **allow-all** — for development. Refuses to run in production.

* **file-based RBAC** — a YAML/JSON file mapping principals to roles and roles to permissions. Sufficient for small deployments.

* **OIDC-claims-based** — derives permissions from claims in the OIDC token (group memberships, scopes, custom claims).

* **HTTP webhook** — defers each authorization decision to an external service. Covers OPA, OpenFGA, Cedar, Condor, and any custom authorization system.

## **8.3 Action vocabulary**

The service defines a vocabulary of actions that the AuthorizationPort can be asked about:

* upload\_to\_namespace, view\_asset, delete\_asset, set\_legal\_hold, lift\_legal\_hold

* create\_namespace, update\_namespace\_policy, archive\_namespace

* create\_preset, update\_preset, deactivate\_preset

* create\_storage\_binding, update\_storage\_binding, test\_storage\_binding

* view\_quarantine\_queue, approve\_quarantine, reject\_quarantine

* view\_audit\_log, export\_evidentiary\_record

* view\_admin\_dashboard, view\_system\_health

# **9\. Client SDK**

## **9.1 Layered architecture**

The TypeScript SDK is published as three layered packages, each usable independently:

### **@lafken/client**

Pure TypeScript HTTP client. No React dependency, no Uppy dependency. Wraps the service's HTTP API: createUploadIntent, confirmUpload, getAsset, getAssetUrl, listAssets, etc. Used directly by server-side consumers (other backend services rendering reports or PDFs) and as the foundation for the higher layers.

### **@lafken/upload**

Framework-agnostic upload manager built on Uppy. Configures Uppy to use the service's signed-URL endpoints for upload parameters. Handles the upload lifecycle: file added → upload intent → bytes uploaded → confirm → poll until ready → expose terminal state. Emits events that any framework can subscribe to.

### **@lafken/react**

React-specific layer: hooks (useImageUpload, useAsset, useAssetUrl) and unstyled component primitives (\<UploadDropzone\>, \<Image\>) built on the upload manager. Components are unstyled by design, following the headless-UI pattern (Radix, shadcn). Consumers apply their own design system.

## **9.2 Upload state representation**

The React hook surfaces both intermediate and terminal states:

const { upload, files } \= useImageUpload({ namespace: 'aircraft-photos' });// each file:// {//   localPreview: dataURL,    // from Uppy thumbnail-generator//   uploadProgress: 0..1,//   state: 'preview' | 'uploading' | 'processing' | 'ready' | 'error',//   assetId: string | undefined,//   servedUrl: string | undefined,    // populated when ready// }

This enables a smooth UX: while the upload is in flight, the local thumbnail (generated client-side by Uppy) is shown. Once the asset reaches 'ready' state, the SDK swaps to the served URL transparently. The user sees their photo immediately and never experiences a placeholder.

## **9.3 Image rendering**

The \<Image\> component takes an asset ID and a preset name:

\<Image assetId="abc-123" preset="detail\_main" /\>\<Image assetId="abc-123" preset="thumbnail" /\>

For namespaces in public mode, the SDK constructs the URL locally without an API call. For signed and proxied modes, the SDK calls getAssetUrl behind the scenes, caches the result for the appropriate TTL, and refreshes before expiration. Application developers do not need to know which mode is in use.

# **10\. Administration Console**

## **10.1 Purpose**

The web administration console is the primary interface for operators to configure, monitor, and operate the service. It is also the primary interface for compliance and reviewer workflows. The console is the only configuration interface — namespace, policy, preset, and storage binding management happen here (or via the equivalent API endpoints), not via configuration files in version control. This means namespace creation is self-service through the console for principals with the right permissions, without external GitOps tooling.

## **10.2 Audiences and views**

The console serves three distinct audiences. Permission-scoped views surface the right capabilities to each:

### **Platform operators**

* System health dashboard: pipeline depth, error rates, recent state transitions, integration status

* Namespace management: list, view, create, edit, archive; policy version history

* Storage binding management: configure adapters, test connections, view per-binding usage

* Preset management: per-namespace preset list, create/edit/version, hit rate stats, pre-generation toggles

* Asset search and inspection: find by ID, namespace, owning record, date, state; full metadata view; state transition history; analyzer findings

* Processing job inspection: view current step, retry count, recent errors for stuck assets

* Bulk operations: re-process, restore from quarantine, force expire (audit-logged, behind elevated permissions)

* Webhook delivery log: per-namespace event subscriptions and delivery status

### **Content reviewers**

* Quarantine queue: assets flagged by virus scan, content moderation, or policy violation; review with full context; approve/reject/escalate with notes

* Legal hold management: place, lift, query holds; case reference tracking; bulk operations by owning record

* Audit log search: query by principal, asset, action, date; export to CSV

* Evidentiary export: generate signed export bundles (manifest \+ originals \+ event history) for handing to investigators

### **Application developers**

* Namespace explorer (scoped to namespaces they have access to)

* Their assets: same search interface as operators, scoped

* Integration debugging: "why was this rejected?" walks through the validation pipeline showing exactly what happened at each step

* Webhook delivery log scoped to their namespaces

## **10.3 First-run experience**

On first deploy, the service starts with sensible defaults: a default storage binding (local filesystem in a configurable directory), a default namespace with a permissive policy, a bootstrap admin principal configured via environment variable. The console renders a working system that the operator adjusts rather than an empty system the operator must configure before doing anything.

For production deployment, real settings are configured before exposing the service to users. The defaults are present for development friction reduction, not for production use.

# **11\. Operational Concerns**

## **11.1 Observability**

The service emits structured logs (JSON) and metrics in OpenTelemetry format, with first-class integration to Cloud Logging and Cloud Monitoring. Key metrics include: upload intent rate, confirm rate, processing pipeline depth per step, per-step latency percentiles, validation rejection rate by reason, virus scan rate and detection rate, content moderation flag rate, processing\_failed rate, URL issuance rate per namespace, storage usage per binding, processing\_jobs queue depth, stale heartbeat reclaim rate.

Logs are written for: every API request (with principal, action, result), every state transition, every authorization decision (configurable verbosity), every adapter call (configurable). Log retention and routing are operator concerns; the service writes structured logs to stdout and the deployment ships them where appropriate.

## **11.2 Quotas and rate limiting**

Per-namespace quotas (storage bytes, monthly upload count, transformation rate) are enforceable. Soft quotas alert; hard quotas reject. This prevents one application's bug from filling a bucket or exhausting a transformation budget.

## **11.3 Backup and disaster recovery**

Lafken's PostgreSQL database holds all configuration (namespaces, policies, presets, storage bindings) and all asset metadata. Loss of the database means loss of the ability to resolve asset\_id to storage key, even if the bytes themselves remain in GCS. Backup discipline is operator responsibility but the service supports point-in-time recovery via standard Cloud SQL automated backups and PostgreSQL tooling.

Configuration export/import endpoints serialize the full configuration as JSON, useful for migrating between environments and for disaster recovery.

## **11.4 Cost reporting**

Per-namespace usage reports cover storage bytes, request counts, transformation invocations, moderation API calls, virus scan calls. Where chargeback is desired, the report provides the inputs. Where it isn't, the report supports capacity planning.

# **12\. Security**

## **12.1 Threat model summary**

The service defends against:

* Malicious uploads: virus scanning, magic-byte detection, format validation, size limits, optional content moderation

* Spoofed content type: server-side detection from bytes, never trusts client-declared MIME type

* Path traversal in storage: storage keys are generated by the service, never include client input

* Signed URL forgery: HMAC-signed URLs with rotating keys, scoped to specific paths and parameters

* Enumeration attacks: UUIDv4 public IDs with 122 bits of entropy

* Configuration tampering: every config change audited, role-gated, and reviewable

* Bypassing authorization: every URL issuance and every API call runs the AuthorizationPort

## **12.2 Internal identifier hygiene**

Lafken uses UUIDv7 values for internal primary keys. These are not a security boundary but they do embed a millisecond timestamp prefix and therefore reveal creation-time information (and, by extension, ordering and rough volume) to anyone who can observe them. The architectural rule is that internal IDs must never appear in:

* API responses (use public\_id for assets, slug for namespaces, name for presets)

* Signed URLs (use public\_id)

* Error messages displayed to end users

* Logs routed to third-party destinations (where developers from other systems may see them)

* Webhook payloads (use public\_id)

Internal IDs may appear freely in operator-facing surfaces: the admin console (visible only to authorized operators), structured logs routed to the operator's own logging infrastructure, and database queries. Code review and integration tests enforce this separation; an external surface accidentally exposing an internal ID is treated as a defect.

## **12.3 What it does not defend against**

Defense-in-depth has limits, and being honest about them matters:

* Compromise of the AuthorizationPort or the underlying authorization system. Lafken trusts what its authorization adapter returns.

* Compromise of the storage backend's signing keys. Anyone with the keys can issue valid URLs.

* Compromise of the service's database. The database is the source of truth for configuration and asset metadata.

* Domain-level lies in custom\_metadata. The service stores what clients say; correctness is the calling application's responsibility to verify.

* Sophisticated content moderation evasion. The moderation port catches general categories; targeted adversaries can craft content that evades.

# **13\. Open Source Strategy**

## **13.1 Licensing**

MIT license. Path of least friction for adoption. Compatible with the broader Node ecosystem. Apache 2.0 is a reasonable alternative if explicit patent grants matter; for a service of this kind, MIT is the conventional choice.

## **13.2 Repository structure**

Monorepo containing: the core service (NestJS), the React-based admin console, the three SDK packages (@lafken/client, @lafken/upload, @lafken/react), shipped adapters, the reference Docker Compose deployment, documentation, and an end-to-end test suite. Single coordinated release cadence at v1.x; may split as the project matures.

## **13.3 Versioning and stability**

Semantic versioning. The HTTP API, port interfaces, and SDK public surface are subject to semver guarantees. Internal modules are not. Pre-1.0 releases reserve the right to make breaking changes with adequate documentation; post-1.0 follows semver strictly.

Port interfaces explicitly versioned with a stability marker. Changes to port interfaces affect every adapter; deliberate, documented changes only.

## **13.4 Documentation**

Documentation is a feature, not an afterthought. The minimum viable documentation set:

* README with quickstart (clone, docker compose up, working in 5 minutes)

* Architecture overview

* Deployment guide (GCP via Cloud Run \+ Cloud SQL, Kubernetes via Helm, configuration reference)

* Operational runbook (common tasks, troubleshooting, monitoring guidance)

* Adapter authoring guide (writing a new adapter for any port)

* API reference (OpenAPI spec generated from code)

* SDK reference for each package

* Security model and threat documentation

* Migration guides for breaking changes between major versions

## **13.5 Cultural acknowledgment**

The README opens with a short acknowledgment that Lafken is a Mapudungun word, briefly introducing the Mapuche people and their language. This is a small gesture of respect that costs nothing and is appropriate when borrowing from an indigenous language for commercial-adjacent purposes.

# **14\. Roadmap and Phasing**

## **14.1 v1.0 — initial release**

Scope of the first stable release:

* Core service with full hexagonal architecture

* Adapters: GCS, S3, local filesystem (storage); allow-all, file-based RBAC, OIDC-claims, HTTP webhook (authorization); ClamAV, no-op (virus); no-op, Cloud Vision, Rekognition, webhook (content moderation); imgproxy (transformer); in-process, webhook, Google Pub/Sub, AWS SNS (events); GCP Secret Manager, environment variables (secrets)

* XState \+ Postgres claim-table workflow with full retry, backoff, jitter, and worker death recovery

* Three serving modes: public, signed, proxied

* Namespace management with versioned policies and presets

* Async pipeline: magic-byte detection, format validation, virus scan, content moderation, optional re-encoding, finalize

* @lafken/client (HTTP wrapper)

* Admin console with non-negotiable views: asset search/detail, namespace CRUD, quarantine review, audit log search, integration debugging, processing job inspection

* Reference Docker Compose deployment

* Helm charts for Kubernetes deployment, with example values for GKE

* Documentation set

## **14.2 v1.x — fast follow**

Within a few months of v1.0:

* @lafken/upload and @lafken/react SDK packages

* Webhook subscription management UI

* Configuration export/import API

* Pre-generation of derivatives for hot-path presets

* Per-namespace usage and cost reporting in the console

* Quotas and rate limiting

## **14.3 v2 and beyond — deliberate deferrals**

Features deliberately deferred until the v1 surface is proven:

* Reference-aware retention (extending retention based on calling-app status of the owning record)

* Cold storage tiering (automatic transition to GCS Coldline / Archive based on access patterns)

* Perceptual hashing and duplicate detection

* Image quality scoring (blur detection, exposure analysis)

* Annotation overlay support (as an asset-relationship feature, not in-place editing)

* Comparison views for related assets

* Full evidentiary export with cryptographic signatures and tamper-evident manifests

* Policy preview and impact analysis ("if I change this policy, what existing assets are affected?")

* Built-in BI dashboards beyond what raw metrics export supports

* Additional transformer adapters (imagor)

* Non-React SDK wrappers (Vue, Svelte, native mobile)

# **15\. Glossary**

| Asset | An uploaded image and its associated metadata, governed by the policy of the namespace it belongs to. |
| :---- | :---- |
| **Namespace** | A logical grouping of assets sharing policy and storage configuration. Typically corresponds to a use case or consuming application. |
| **Policy** | Versioned, immutable declaration of how assets in a namespace are validated, stored, processed, and served. |
| **Preset** | Named transformation configuration. Clients reference presets by name when requesting URLs. |
| **Public ID** | External UUIDv4 identifier exposed to clients. Used in URLs, API responses, webhook payloads, and client-side storage. The only asset identifier that crosses the service boundary. |
| **Internal ID** | UUIDv7 value used as the primary key for internal tables. Never exposed externally. The architectural separation from public\_id is what keeps the embedded creation timestamp from leaking. |
| **Upload intent** | Server-issued reservation for a future upload, including a public ID, a signed storage URL, and validation parameters. |
| **Processing job** | A row in the processing\_jobs table representing an asset that needs (or is undergoing) processing. Workers claim these with heartbeat-based leases. |
| **Serving mode** | How URLs for a namespace's assets are constructed and authorized: public, signed, or proxied. |
| **Quarantine** | Terminal state for assets that failed virus scanning or content moderation. Subject to review workflows. |
| **processing\_failed** | Terminal state for assets where the workflow couldn't complete despite retries. Distinct from quarantine: the system couldn't determine the asset's status, rather than determining it was problematic. |
| **Legal hold** | Flag preventing retention-based deletion regardless of policy. Used for litigation, investigation, accident records. |
| **Capture context** | Structured field-capture data: when/where/by whom/with what device the image was captured. Distinct from EXIF (which lives in image bytes) and custom\_metadata (which is application-specific). |
| **Owning record** | Optional link from an asset to a domain entity in a calling application (e.g., 'this photo belongs to work\_order/wo-123'). Enables reference-aware features. |
| **Hexagonal architecture** | Architecture pattern (ports and adapters) where domain logic depends on abstract interfaces (ports), and infrastructure concerns are isolated in implementations of those interfaces (adapters). |
| **Heartbeat** | Periodic update by a worker to its claimed processing\_jobs row, indicating the worker is still alive. A sweeper reclaims jobs whose heartbeats have gone stale. |
| **Bucketed expiration** | Pattern of rounding signed URL expiration timestamps to bucket boundaries (e.g., 15-minute granularity) so that URLs issued within a bucket share a cache key, enabling CDN caching of signed URLs. |

