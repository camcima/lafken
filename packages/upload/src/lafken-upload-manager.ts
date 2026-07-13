import type { LafkenClient } from "@lafken/client";
import Uppy, { type UppyFile } from "@uppy/core";
import XHRUpload from "@uppy/xhr-upload";

export interface ISharedUploadMetadata {
  externalRefType?: string;
  externalRefId?: string;
  note?: string;
  tags?: string[];
}

/**
 * Subset of Uppy's `restrictions` exposed on the public SDK surface. Consumers
 * pass these to enforce policy *before* a file enters the upload queue —
 * disallowed files trigger a `file-restriction-rejected` event instead of being added.
 *
 * Server-side enforcement is still the authority; restrictions are a UX
 * accelerator so users see immediate feedback on drop.
 */
export interface IUploadRestrictions {
  /** MIME types or extensions, e.g. `["image/png", ".jpg"]`. */
  allowedFileTypes?: string[];
  /** Per-file size cap in bytes. */
  maxFileSize?: number;
  /** Total bytes per batch cap. */
  maxTotalFileSize?: number;
  /** Max files per batch. */
  maxNumberOfFiles?: number;
}

export interface ILafkenUploadManagerOptions {
  client: LafkenClient;
  namespaceSlug: string;
  /** Initial restrictions; can be updated later via `setRestrictions`. */
  restrictions?: IUploadRestrictions;
  /** ms before `expiresAt` at which to pre-flight a URL refresh. Default 30000. */
  refreshSafetyMarginMs?: number;
  /** Initial polling interval in ms when waiting for asset processing. Default 1000. */
  pollingIntervalMs?: number;
  /** Maximum polling interval (cap for backoff). Default 10_000. */
  pollingMaxIntervalMs?: number;
  /** Total polling timeout in ms before emitting file-failed("polling-timeout"). Default 600_000. */
  pollingTimeoutMs?: number;
}

export interface IFileConfirmedEventDetail {
  fileId: string;
  publicId: string;
}

export interface IFileProcessingEventDetail {
  fileId: string;
  publicId: string;
}

export interface IFileReadyEventDetail {
  fileId: string;
  publicId: string;
  asset: { state: string; publicId: string };
}

export type QuarantineKind = "virus" | "moderation" | "invalid_format" | (string & {});

export interface IFileQuarantinedEventDetail {
  fileId: string;
  publicId: string;
  kind: QuarantineKind;
}

export interface IFileRejectedTerminalEventDetail {
  fileId: string;
  publicId: string;
}

export interface IFileFailedEventDetail {
  fileId: string;
  error: Error;
}

/**
 * Emitted when a file is rejected by client-side Uppy restrictions before it
 * enters the upload queue (wrong MIME type, too large, etc.). This is distinct
 * from server-side terminal rejection (`file-rejected-terminal`).
 */
export interface IFileRestrictionRejectedEventDetail {
  /** Stable id for the rejection (the file never enters the Uppy queue). */
  rejectionId: string;
  fileName: string;
  mimeType: string;
  size: number;
  error: Error;
}

/**
 * @deprecated Use `IFileRestrictionRejectedEventDetail` instead.
 * The event name has been renamed from `file-rejected` to `file-restriction-rejected`.
 */
export type IFileRejectedEventDetail = IFileRestrictionRejectedEventDetail;

type AnyMeta = Record<string, unknown>;
type AnyBody = Record<string, never>;

interface IImageDimensions {
  width: number;
  height: number;
}

function toUppyRestrictions(r: IUploadRestrictions): {
  allowedFileTypes?: string[] | null;
  maxFileSize?: number | null;
  maxTotalFileSize?: number | null;
  maxNumberOfFiles?: number | null;
} {
  // Uppy uses `null` to mean "no restriction"; `undefined` would inherit the
  // previous value. We pass `null` explicitly so a caller clearing a field
  // (e.g., on namespace switch) actually clears it.
  return {
    allowedFileTypes: r.allowedFileTypes ?? null,
    maxFileSize: r.maxFileSize ?? null,
    maxTotalFileSize: r.maxTotalFileSize ?? null,
    maxNumberOfFiles: r.maxNumberOfFiles ?? null,
  };
}

async function probeImageDimensions(file: File): Promise<IImageDimensions> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("not-an-image"));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = (): void => {
      const result: IImageDimensions = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(result);
    };
    img.onerror = (): void => {
      URL.revokeObjectURL(url);
      reject(new Error("image-decode-failed"));
    };
    img.src = url;
  });
}

/**
 * Derive a quarantine kind string from the asset state.
 * `quarantined_virus` → `"virus"`, `quarantined_moderation` → `"moderation"`, etc.
 */
function quarantineKindFromState(state: string): QuarantineKind {
  const prefix = "quarantined_";
  if (state.startsWith(prefix)) {
    return state.slice(prefix.length);
  }
  return state;
}

const DEFAULT_REFRESH_SAFETY_MARGIN_MS = 30_000;
const DEFAULT_POLLING_INTERVAL_MS = 1_000;
const DEFAULT_POLLING_MAX_INTERVAL_MS = 10_000;
const DEFAULT_POLLING_TIMEOUT_MS = 600_000;

/** Terminal states: polling stops immediately on these. */
const TERMINAL_STATES = new Set([
  "ready",
  "rejected",
  "quarantined_virus",
  "quarantined_moderation",
  "quarantined_invalid_format",
  "processing_failed",
  "expired",
  "deleted",
]);

export class LafkenUploadManager extends EventTarget {
  private readonly uppy: Uppy<AnyMeta, AnyBody>;
  private readonly publicIdByFileId = new Map<string, string>();
  private readonly dimProbesByFileId = new Map<string, Promise<IImageDimensions | null>>();
  private readonly expiresAtByFileId = new Map<string, Date>();
  private sharedMetadata: ISharedUploadMetadata = {};
  private readonly refreshSafetyMarginMs: number;
  private readonly pollingIntervalMs: number;
  private readonly pollingMaxIntervalMs: number;
  private readonly pollingTimeoutMs: number;
  /** Active polling timeouts keyed by fileId, cleared on cancelAll(). */
  private readonly activePollingTimers = new Set<ReturnType<typeof setTimeout>>();
  private cancelled = false;

  constructor(private readonly opts: ILafkenUploadManagerOptions) {
    super();
    this.refreshSafetyMarginMs = opts.refreshSafetyMarginMs ?? DEFAULT_REFRESH_SAFETY_MARGIN_MS;
    this.pollingIntervalMs = opts.pollingIntervalMs ?? DEFAULT_POLLING_INTERVAL_MS;
    this.pollingMaxIntervalMs = opts.pollingMaxIntervalMs ?? DEFAULT_POLLING_MAX_INTERVAL_MS;
    this.pollingTimeoutMs = opts.pollingTimeoutMs ?? DEFAULT_POLLING_TIMEOUT_MS;

    this.uppy = new Uppy<AnyMeta, AnyBody>({
      autoProceed: false,
      allowMultipleUploadBatches: true,
      restrictions: opts.restrictions ? toUppyRestrictions(opts.restrictions) : undefined,
    });

    // Surface Uppy's restriction violations as a `file-restriction-rejected` event so the
    // React layer can show toasts / inline errors. The file never makes it into
    // Uppy's queue, so it never gets a tile — the consumer treats it as
    // out-of-band feedback.
    this.uppy.on("restriction-failed", (file, err) => {
      const error = err instanceof Error ? err : new Error(String(err));
      this.dispatchEvent(
        new CustomEvent<IFileRestrictionRejectedEventDetail>("file-restriction-rejected", {
          detail: {
            rejectionId: `rej-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            fileName: file?.name ?? "(unnamed)",
            mimeType: file?.type ?? "application/octet-stream",
            size: file?.size ?? 0,
            error,
          },
        }),
      );
    });

    this.uppy.use(XHRUpload, {
      endpoint: "placeholder",
      method: "PUT",
      formData: false,
    });

    // Pre-processor: call createUploadIntent per file and store the upload URL/headers
    // as per-file overrides before the upload starts. Each file is handled
    // independently — a failure for one file (e.g. the namespace policy rejects
    // the MIME type) must not abort the rest of the batch.
    this.uppy.addPreProcessor((fileIds: string[]) => this.runPreProcessing(fileIds));

    this.uppy.on("complete", (result) => {
      void this.confirmCompletedFiles(result.successful ?? []);
    });
  }

  addFiles(files: File[]): void {
    for (const file of files) {
      const fileId = this.uppy.addFile({
        name: file.name,
        type: file.type,
        data: file,
        source: "lafken-upload",
      });
      // Probe dimensions in parallel — failures are non-fatal (we just don't
      // forward width/height). The probe typically completes well before the
      // user clicks Start, so confirmCompletedFiles can await the result.
      this.dimProbesByFileId.set(
        fileId,
        probeImageDimensions(file).catch(() => null),
      );
    }
  }

  removeFile(fileId: string): void {
    // Guard against double-removal — the file may have already been dropped
    // from Uppy by the pre-processor's per-file error path. Calling
    // `uppy.removeFile` on a missing id throws.
    if (this.uppy.getFile(fileId)) {
      this.uppy.removeFile(fileId);
    }
    this.publicIdByFileId.delete(fileId);
    this.dimProbesByFileId.delete(fileId);
    this.expiresAtByFileId.delete(fileId);
  }

  async start(): Promise<void> {
    this.cancelled = false;
    await this.uppy.upload();
  }

  /**
   * Updates the metadata applied to every file confirmed in subsequent
   * `start()` calls. Replaces (does not merge) the previous shared metadata
   * so callers don't accumulate stale fields between batches.
   */
  setSharedMetadata(metadata: ISharedUploadMetadata): void {
    this.sharedMetadata = { ...metadata };
  }

  /**
   * Replaces the active Uppy restrictions. Use when policy state changes
   * (e.g., the user switches namespace or the namespace policy is updated).
   * Files already in the queue are untouched; restrictions affect files added
   * after this call.
   */
  setRestrictions(restrictions: IUploadRestrictions): void {
    this.uppy.setOptions({ restrictions: toUppyRestrictions(restrictions) });
  }

  cancelAll(): void {
    this.cancelled = true;
    // Clear all active polling timers.
    for (const timer of this.activePollingTimers) {
      clearTimeout(timer);
    }
    this.activePollingTimers.clear();
    this.uppy.cancelAll();
    this.publicIdByFileId.clear();
    this.dimProbesByFileId.clear();
    this.expiresAtByFileId.clear();
  }

  getUppy(): Uppy<AnyMeta, AnyBody> {
    return this.uppy;
  }

  private async runPreProcessing(fileIds: string[]): Promise<void> {
    const failedIds: string[] = [];
    await Promise.all(
      fileIds.map(async (fileId) => {
        const file = this.uppy.getFile(fileId);
        if (!file) return;

        try {
          const result = await this.opts.client.assets.createUploadIntent({
            namespaceSlug: this.opts.namespaceSlug,
            declaredMimeType: (file.type as string | undefined) ?? "application/octet-stream",
            declaredSizeBytes: (file.size as number | undefined) ?? 0,
          });

          let uploadUrl: string = result.uploadUrl;
          let uploadHeaders: Record<string, string> = result.uploadHeaders;
          const expiresAt = new Date(result.expiresAt);

          // Pre-flight URL refresh when the signed URL is within the safety
          // margin of expiry. This guards against long idle time between
          // addFiles() and start().
          if (expiresAt.getTime() - Date.now() < this.refreshSafetyMarginMs) {
            try {
              const refreshed = await this.opts.client.assets.refreshUploadUrl(result.publicId);
              uploadUrl = refreshed.uploadUrl;
              uploadHeaders = refreshed.uploadHeaders;
              this.expiresAtByFileId.set(fileId, new Date(refreshed.expiresAt));
            } catch (err) {
              const error = err instanceof Error ? err : new Error(String(err));
              this.dispatchEvent(
                new CustomEvent<IFileFailedEventDetail>("file-failed", {
                  detail: { fileId, error },
                }),
              );
              failedIds.push(fileId);
              return;
            }
          } else {
            this.expiresAtByFileId.set(fileId, expiresAt);
          }

          this.publicIdByFileId.set(fileId, result.publicId);

          this.uppy.setFileState(fileId, {
            xhrUpload: {
              endpoint: uploadUrl,
              method: "PUT",
              formData: false,
              headers: uploadHeaders,
            },
          });
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          this.dispatchEvent(
            new CustomEvent<IFileFailedEventDetail>("file-failed", {
              detail: { fileId, error },
            }),
          );
          failedIds.push(fileId);
        }
      }),
    );
    // Drop failed files from Uppy so the rest of the batch can upload. The
    // consumer's React layer keeps the tile visible by retaining files in
    // "error" state even after they're removed from Uppy.
    for (const failedId of failedIds) {
      this.uppy.removeFile(failedId);
    }
  }

  private async confirmCompletedFiles(
    successful: ReadonlyArray<UppyFile<AnyMeta, AnyBody>>,
  ): Promise<void> {
    for (const file of successful) {
      const publicId = this.publicIdByFileId.get(file.id);
      if (!publicId) continue;
      try {
        const dims = await this.dimProbesByFileId.get(file.id);
        const merged = {
          ...this.sharedMetadata,
          ...(dims ? { width: dims.width, height: dims.height } : {}),
        };
        const options = Object.keys(merged).length > 0 ? merged : undefined;
        const confirmed = await this.opts.client.assets.confirmUpload(publicId, options);

        await this.handleConfirmedAsset(file.id, publicId, confirmed);
      } catch (err) {
        this.dispatchEvent(
          new CustomEvent<IFileFailedEventDetail>("file-failed", {
            detail: {
              fileId: file.id,
              error: err instanceof Error ? err : new Error(String(err)),
            },
          }),
        );
      }
    }
  }

  /**
   * Branch on the confirmed asset's state and emit the appropriate lifecycle
   * event. For assets in `processing`, also initiates the polling loop.
   */
  private async handleConfirmedAsset(
    fileId: string,
    publicId: string,
    asset: { state: string; publicId: string },
  ): Promise<void> {
    const state = asset.state;

    if (state.startsWith("quarantined_")) {
      const kind = quarantineKindFromState(state);
      this.dispatchEvent(
        new CustomEvent<IFileQuarantinedEventDetail>("file-quarantined", {
          detail: { fileId, publicId, kind },
        }),
      );
      return;
    }

    if (state === "rejected") {
      this.dispatchEvent(
        new CustomEvent<IFileRejectedTerminalEventDetail>("file-rejected-terminal", {
          detail: { fileId, publicId },
        }),
      );
      return;
    }

    if (state === "processing_failed") {
      this.dispatchEvent(
        new CustomEvent<IFileFailedEventDetail>("file-failed", {
          detail: {
            fileId,
            error: new Error("processing_failed"),
          },
        }),
      );
      return;
    }

    if (state === "ready") {
      this.dispatchEvent(
        new CustomEvent<IFileReadyEventDetail>("file-ready", {
          detail: { fileId, publicId, asset },
        }),
      );
      return;
    }

    if (state === "processing") {
      this.dispatchEvent(
        new CustomEvent<IFileProcessingEventDetail>("file-processing", {
          detail: { fileId, publicId },
        }),
      );
      await this.pollUntilTerminal(fileId, publicId);
      return;
    }

    // For any other state (e.g. "confirmed", "uploaded", "pending") emit
    // file-confirmed to preserve backward compatibility.
    this.dispatchEvent(
      new CustomEvent<IFileConfirmedEventDetail>("file-confirmed", {
        detail: { fileId, publicId },
      }),
    );
  }

  /**
   * Poll `client.assets.get(publicId)` with exponential backoff until the
   * asset reaches a terminal state or the polling timeout elapses.
   *
   * Backoff sequence: pollingIntervalMs, 2×, 4×, … capped at pollingMaxIntervalMs.
   */
  private async pollUntilTerminal(fileId: string, publicId: string): Promise<void> {
    const startedAt = Date.now();
    let intervalMs = this.pollingIntervalMs;

    while (true) {
      if (this.cancelled) return;

      // Wait for current interval via a cancellable sleep.
      const slept = await this.cancellableSleep(intervalMs);
      if (!slept) return; // cancelled during sleep

      if (Date.now() - startedAt >= this.pollingTimeoutMs) {
        this.dispatchEvent(
          new CustomEvent<IFileFailedEventDetail>("file-failed", {
            detail: {
              fileId,
              error: new Error("polling-timeout"),
            },
          }),
        );
        return;
      }

      let asset: { state: string; publicId: string };
      try {
        asset = await this.opts.client.assets.get(publicId);
      } catch {
        // Transient errors — keep polling; the timeout will stop us eventually.
        intervalMs = Math.min(intervalMs * 2, this.pollingMaxIntervalMs);
        continue;
      }

      if (this.cancelled) return;

      const state = asset.state;

      if (state === "ready") {
        this.dispatchEvent(
          new CustomEvent<IFileReadyEventDetail>("file-ready", {
            detail: { fileId, publicId, asset },
          }),
        );
        return;
      }

      if (state.startsWith("quarantined_")) {
        const kind = quarantineKindFromState(state);
        this.dispatchEvent(
          new CustomEvent<IFileQuarantinedEventDetail>("file-quarantined", {
            detail: { fileId, publicId, kind },
          }),
        );
        return;
      }

      if (state === "rejected") {
        this.dispatchEvent(
          new CustomEvent<IFileRejectedTerminalEventDetail>("file-rejected-terminal", {
            detail: { fileId, publicId },
          }),
        );
        return;
      }

      if (state === "processing_failed") {
        this.dispatchEvent(
          new CustomEvent<IFileFailedEventDetail>("file-failed", {
            detail: {
              fileId,
              error: new Error("processing_failed"),
            },
          }),
        );
        return;
      }

      if (TERMINAL_STATES.has(state)) {
        this.dispatchEvent(
          new CustomEvent<IFileReadyEventDetail>("file-ready", {
            detail: { fileId, publicId, asset },
          }),
        );
        return;
      }

      // Not yet terminal — advance backoff and continue.
      intervalMs = Math.min(intervalMs * 2, this.pollingMaxIntervalMs);
    }
  }

  /**
   * Sleep for `ms` milliseconds. Returns `true` if the sleep completed
   * normally, `false` if cancelled via `cancelAll()`.
   */
  private cancellableSleep(ms: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        this.activePollingTimers.delete(timer);
        resolve(true);
      }, ms);
      this.activePollingTimers.add(timer);
    });
  }
}
