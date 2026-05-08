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
 * disallowed files trigger a `file-rejected` event instead of being added.
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
}

export interface IFileConfirmedEventDetail {
  fileId: string;
  publicId: string;
}

export interface IFileFailedEventDetail {
  fileId: string;
  error: Error;
}

export interface IFileRejectedEventDetail {
  /** Stable id for the rejection (the file never enters the Uppy queue). */
  rejectionId: string;
  fileName: string;
  mimeType: string;
  size: number;
  error: Error;
}

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

export class LafkenUploadManager extends EventTarget {
  private readonly uppy: Uppy<AnyMeta, AnyBody>;
  private readonly publicIdByFileId = new Map<string, string>();
  private readonly dimProbesByFileId = new Map<string, Promise<IImageDimensions | null>>();
  private sharedMetadata: ISharedUploadMetadata = {};

  constructor(private readonly opts: ILafkenUploadManagerOptions) {
    super();
    this.uppy = new Uppy<AnyMeta, AnyBody>({
      autoProceed: false,
      allowMultipleUploadBatches: true,
      restrictions: opts.restrictions ? toUppyRestrictions(opts.restrictions) : undefined,
    });

    // Surface Uppy's restriction violations as a `file-rejected` event so the
    // React layer can show toasts / inline errors. The file never makes it into
    // Uppy's queue, so it never gets a tile — the consumer treats it as
    // out-of-band feedback.
    this.uppy.on("restriction-failed", (file, err) => {
      const error = err instanceof Error ? err : new Error(String(err));
      this.dispatchEvent(
        new CustomEvent<IFileRejectedEventDetail>("file-rejected", {
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
    // as per-file xhrUpload overrides before the upload starts. Each file is
    // handled independently — a failure for one file (e.g. the namespace
    // policy rejects the MIME type) must not abort the rest of the batch.
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
  }

  async start(): Promise<void> {
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
    this.uppy.cancelAll();
    this.publicIdByFileId.clear();
    this.dimProbesByFileId.clear();
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
          const result = await this.opts.client.createUploadIntent({
            namespaceSlug: this.opts.namespaceSlug,
            declaredMimeType: (file.type as string | undefined) ?? "application/octet-stream",
            declaredSizeBytes: (file.size as number | undefined) ?? 0,
          });

          this.publicIdByFileId.set(fileId, result.publicId);

          this.uppy.setFileState(fileId, {
            xhrUpload: {
              endpoint: result.uploadUrl,
              method: "PUT",
              formData: false,
              headers: result.uploadHeaders,
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
        const confirmed = await this.opts.client.confirmUpload(publicId, options);
        // The server may accept the upload but transition the asset directly
        // into a quarantine state (e.g. magic-byte sniff disagreed with the
        // declared MIME). Surface that as a failed file so the UI can show
        // the verdict instead of a misleading "Uploaded" badge.
        if (typeof confirmed.state === "string" && confirmed.state.startsWith("quarantined_")) {
          this.dispatchEvent(
            new CustomEvent<IFileFailedEventDetail>("file-failed", {
              detail: {
                fileId: file.id,
                error: new Error(`quarantined: ${confirmed.state}`),
              },
            }),
          );
          continue;
        }
        this.dispatchEvent(
          new CustomEvent<IFileConfirmedEventDetail>("file-confirmed", {
            detail: { fileId: file.id, publicId },
          }),
        );
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
}
