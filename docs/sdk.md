# SDK

Lafken ships three NPM packages that together form the official
client surface. The web admin console in this repo uses these same
packages — there is no private fast path.

| Package | Purpose | Peer dependencies |
| ------- | ------- | ----------------- |
| `@lafken/client` | Typed REST client. One method per public endpoint, grouped by bounded context. | `@shared/backend-api` (DTOs only). |
| `@lafken/upload` | Browser-side upload manager. Wraps Uppy with the simple/tus protocol switch and signed-URL refresh. | `@lafken/client`. |
| `@lafken/react` | React hooks and components. | `react ^19`, `@tanstack/react-query ^5`. |

DTO shapes come from `@shared/backend-api` and are imported with
`import type`. The SDK does not redefine them.

Lafken is pre-1.0; SDK breaking changes are released without
deprecation cycles until the v1.0 tag is cut.

## `@lafken/client`

```ts
import { LafkenClient } from "@lafken/client";

const client = new LafkenClient({
  baseUrl: "http://localhost:3000",
  getAuthToken: async () => "<bearer token>",
});

// assets
await client.assets.list({ namespaceSlug: "marketing" });
await client.assets.get(publicId);
await client.assets.createUploadIntent({
  namespaceSlug: "marketing",
  declaredMimeType: "image/jpeg",
  declaredSizeBytes: 102_400,
  protocol: "simple",
});
await client.assets.refreshUploadUrl(publicId);
await client.assets.confirmUpload(publicId, { width: 1024, height: 768 });
await client.assets.getPreviewUrl({ publicId, preset: "card" });
await client.assets.getDownloadUrl({ publicId });
await client.assets.listStateTransitions(publicId);
await client.assets.listAnalyses(publicId);
await client.assets.getProcessingJob(publicId);
await client.assets.retryProcessing(publicId);

// namespaces, presets, policies
client.namespaces.list();
client.namespaces.get(slug);
client.namespaces.create(input);
client.namespaces.updateMetadata(slug, patch);
client.namespaces.archive(slug);
client.namespaces.unarchive(slug);
client.namespaces.listPolicies(slug);
client.namespaces.createPolicyVersion(slug, input);
client.namespaces.listPresets(slug);
client.namespaces.createPreset(slug, input);
client.namespaces.updatePresetVersion(slug, name, input);
client.namespaces.setPresetActive(slug, name, body);

// system
client.system.listStorageBindings();
client.system.getStorageBinding(name);
client.system.createStorageBinding(input);
client.system.updateStorageBinding(name, patch);
client.system.deleteStorageBinding(name);
client.system.listIntegrations();
client.system.getHealth();

// quarantine, legal holds, audit, dashboard
client.quarantine.list(query);
client.quarantine.release(publicId, body);
client.quarantine.reject(publicId, body);
client.legalHolds.list(query);
client.legalHolds.get(id);
client.legalHolds.place(input);
client.legalHolds.lift(id, body);
client.audit.list(query);
client.dashboard.getOverview();
```

Errors raised by the transport are typed `LafkenApiError`, with
`status` and `problemDetails` (RFC 9457 `application/problem+json`).

## `@lafken/upload`

`LafkenUploadManager` orchestrates the full upload lifecycle: create
intent, attach Uppy, retry, refresh signed URL near expiry, confirm,
then poll the asset until a terminal state.

```ts
import { LafkenUploadManager } from "@lafken/upload";

const manager = new LafkenUploadManager({
  client,
  namespaceSlug: "marketing",
  protocol: "simple",            // or "tus"
  refreshSafetyMarginMs: 30_000, // refresh if URL expires within 30 s
});

manager.addEventListener("file-processing", (e) => { /* ... */ });
manager.addEventListener("file-ready", (e) => { /* ... */ });
manager.addEventListener("file-quarantined", (e) => { /* ... */ });
manager.addEventListener("file-rejected-terminal", (e) => { /* ... */ });
manager.addEventListener("file-failed", (e) => { /* ... */ });
manager.addEventListener("file-restriction-rejected", (e) => { /* ... */ });

manager.addFiles([file]);
await manager.start();
```

`LafkenUploadManager` extends `EventTarget`; lifecycle events arrive
as `CustomEvent` instances.

| Event | When |
| ----- | ---- |
| `file-processing` | Confirm returned with `state: processing`. Manager begins polling. |
| `file-ready` | Asset reached `ready`. |
| `file-quarantined` | Asset reached `quarantined_virus`, `quarantined_moderation`, or `quarantined_invalid_format`. |
| `file-rejected-terminal` | Asset reached `rejected`. |
| `file-failed` | `processing_failed`, polling timed out, intent or confirm errored. |
| `file-restriction-rejected` | Uppy refused the file at drop time (wrong type, too large, etc.). |
| `file-confirmed` | Confirm returned with a non-terminal, non-`processing` state (back-compat). |

Switching to tus is one line: pass `protocol: "tus"` and ensure
`TUSD_ENDPOINT_URL` is configured on the backend. The manager swaps
`@uppy/xhr-upload` for `@uppy/tus` internally. Polling backoff is
configurable via `pollingIntervalMs`, `pollingMaxIntervalMs`,
`pollingTimeoutMs` (default 600 000 ms).

## `@lafken/react`

### `LafkenProvider`

Mount once near the top of the React tree.

```tsx
import { LafkenProvider } from "@lafken/react";

<LafkenProvider client={client}>
  <App />
</LafkenProvider>
```

The provider exposes the `LafkenClient` to descendants via context.
Hooks that use TanStack Query (e.g. `useAsset`) read the surrounding
`QueryClientProvider`; the SDK does not mount its own.

### `useAsset(publicId)`

```tsx
const { data, isLoading, error } = useAsset(publicId);
```

Cache key: `["lafken", "asset", publicId]`.

### `<UploadDropzone>`

`<UploadDropzone>` is a headless component: pass a `render` prop and
build the UI yourself.

```tsx
<UploadDropzone
  client={client}
  namespaceSlug="marketing"
  protocol="simple"
  render={({ files, rejections, getInputProps, getRootProps, startUpload }) => (
    <div {...getRootProps()}>
      <input {...getInputProps()} />
      {/* render file tiles, rejections, etc. */}
      <button onClick={() => void startUpload()}>Upload</button>
    </div>
  )}
/>
```

For full control of the lifecycle, use `useImageUpload` directly:

```tsx
const upload = useImageUpload({ client, namespaceSlug: "marketing" });
// upload.files[i].state:
//   'idle' | 'preview' | 'uploading' | 'processing'
//   | 'ready' | 'rejected' | 'quarantined' | 'failed' | 'error'
```

After `confirmUpload` resolves, the underlying manager polls
`client.assets.get()` with exponential backoff until a terminal
state. Configurable via `pollingIntervalMs`, `pollingMaxIntervalMs`,
`pollingTimeoutMs` (default 600 000 ms).

### `<AssetImage>` and `useAssetPresetUrl`

```tsx
<AssetImage publicId={asset.publicId} preset="card" alt="..." />
```

Both use a TTL-aware in-memory cache. Lookups within the refresh
threshold of expiry kick a background refresh; the current URL stays
in the `<img>` until the refresh resolves, at which point `<img src>`
swaps to the new URL. On `<img onError>` the cache evicts and retries
once.

## Auth integration

`LafkenClient` accepts `getAuthToken: () => Promise<string | null>`.
The transport calls it before each request and injects
`Authorization: Bearer <token>` when a token is returned. The web
admin console wires this to its `AuthContext.getAccessToken()`.

## Error handling

All errors thrown by `LafkenClient` extend `LafkenApiError`:

```ts
class LafkenApiError extends Error {
  status: number;
  problemDetails: ProblemDetails | null; // RFC 9457
}
```

`ProblemDetails` matches the `application/problem+json` body. Use
`error.problemDetails?.type` to discriminate domain errors when the
status alone is ambiguous.
