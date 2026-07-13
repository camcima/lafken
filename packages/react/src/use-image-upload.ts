import type { LafkenClient } from "@lafken/client";
import {
  type IFileConfirmedEventDetail,
  type IFileFailedEventDetail,
  type IFileProcessingEventDetail,
  type IFileQuarantinedEventDetail,
  type IFileReadyEventDetail,
  type IFileRejectedTerminalEventDetail,
  type IFileRestrictionRejectedEventDetail,
  type ISharedUploadMetadata,
  type IUploadRestrictions,
  LafkenUploadManager,
} from "@lafken/upload";
import { useCallback, useEffect, useRef, useState } from "react";

export type UploadFileState =
  | "idle"
  | "preview"
  | "uploading"
  | "processing"
  | "ready"
  | "rejected"
  | "quarantined"
  | "failed"
  | "error";

export interface IUploadFileError {
  message: string;
  /** Set for quarantined files to indicate the kind of quarantine (e.g. "virus"). */
  kind?: string;
}

export interface IUploadFile {
  id: string;
  name: string;
  size: number;
  type: string;
  state: UploadFileState;
  publicId: string | null;
  /**
   * Structured error. Set when state is `error`, `failed`, `quarantined`, or
   * `rejected`. For `error` state the `message` is the raw error message. For
   * `quarantined` files the `kind` field indicates the quarantine reason.
   */
  error: IUploadFileError | null;
  /**
   * Object URL for browser-side previews of the source bytes. `null` when the
   * file has no preview (e.g. non-image MIME types, or once a removed file's
   * URL has been revoked). Lifetime is managed by the hook — consumers must
   * not call `URL.revokeObjectURL` on it.
   */
  previewUrl: string | null;
  /**
   * The terminal asset DTO returned by the backend once the file has reached a
   * terminal lifecycle state (`ready`, `quarantined`, `rejected`).
   */
  terminalAsset?: { state: string; publicId: string } | null;
}

export interface IUseImageUploadOptions {
  client: LafkenClient;
  namespaceSlug: string;
  /**
   * Optional shared metadata applied to every file confirmed in the next
   * `startUpload()` call. Read on each `startUpload` so callers can update
   * fields between batches without remounting.
   */
  sharedMetadata?: ISharedUploadMetadata;
  /**
   * File-level restrictions enforced on drop. When the user picks a file that
   * violates these (e.g., wrong MIME type, too large), Uppy refuses to add it
   * and a rejection appears in `rejections` for the consumer to surface.
   * Updates take effect for files added after the change.
   */
  restrictions?: IUploadRestrictions;
  /**
   * Ms before `expiresAt` at which to pre-flight a URL refresh. Default 30000.
   * Only relevant when the user adds files well before clicking upload.
   */
  refreshSafetyMarginMs?: number;
  /** Initial polling interval in ms when waiting for asset processing. Default 1000. */
  pollingIntervalMs?: number;
  /** Maximum polling interval (cap for backoff). Default 10_000. */
  pollingMaxIntervalMs?: number;
  /** Total polling timeout in ms before emitting file-failed("polling-timeout"). Default 600_000. */
  pollingTimeoutMs?: number;
}

export interface IUploadRejection {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  message: string;
}

export interface IUseImageUploadResult {
  files: IUploadFile[];
  rejections: IUploadRejection[];
  dismissRejection: (id: string) => void;
  addFiles: (files: File[]) => void;
  removeFile: (id: string) => void;
  startUpload: () => Promise<void>;
  isUploading: boolean;
}

export function useImageUpload(opts: IUseImageUploadOptions): IUseImageUploadResult {
  // useState lazy initializer guarantees the manager is created exactly once
  // for the lifetime of the component. We deliberately ignore later changes to
  // `opts.client` / `opts.namespaceSlug` — re-creating the manager mid-flight
  // would orphan in-flight uploads. Consumers must remount to switch namespaces.
  const initialRestrictions = opts.restrictions;
  const initialRefreshSafetyMarginMs = opts.refreshSafetyMarginMs;
  const initialPollingIntervalMs = opts.pollingIntervalMs;
  const initialPollingMaxIntervalMs = opts.pollingMaxIntervalMs;
  const initialPollingTimeoutMs = opts.pollingTimeoutMs;
  const [manager] = useState<LafkenUploadManager>(
    () =>
      new LafkenUploadManager({
        client: opts.client,
        namespaceSlug: opts.namespaceSlug,
        restrictions: initialRestrictions,
        refreshSafetyMarginMs: initialRefreshSafetyMarginMs,
        pollingIntervalMs: initialPollingIntervalMs,
        pollingMaxIntervalMs: initialPollingMaxIntervalMs,
        pollingTimeoutMs: initialPollingTimeoutMs,
      }),
  );
  const [files, setFiles] = useState<IUploadFile[]>([]);
  const [rejections, setRejections] = useState<IUploadRejection[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  // Object URLs are precious: each createObjectURL leaks until revoked. We map
  // fileId → URL and revoke on file-removed and on unmount.
  const previewUrlsRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const uppy = manager.getUppy();
    const previewUrls = previewUrlsRef.current;
    function syncFromUppy(): void {
      const all = uppy.getFiles();
      const uppyIds = new Set(all.map((f) => f.id));
      setFiles((prev) => {
        // Errored files may have been dropped from Uppy (e.g. createUploadIntent
        // rejected by the namespace policy). Keep them visible in the React list
        // so the user sees the failure and can dismiss the tile manually.
        const ghosts = prev.filter((p) => p.state === "error" && !uppyIds.has(p.id));
        // Drop preview URLs for files no longer tracked anywhere.
        const trackedIds = new Set([...uppyIds, ...ghosts.map((g) => g.id)]);
        for (const [fileId, url] of previewUrls) {
          if (!trackedIds.has(fileId)) {
            URL.revokeObjectURL(url);
            previewUrls.delete(fileId);
          }
        }
        const fromUppy = all.map((f) => {
          const previous = prev.find((p) => p.id === f.id);
          let previewUrl: string | null = previewUrls.get(f.id) ?? null;
          if (!previewUrl) {
            const data = f.data as Blob | undefined;
            if (data instanceof Blob && (f.type ?? "").startsWith("image/")) {
              previewUrl = URL.createObjectURL(data);
              previewUrls.set(f.id, previewUrl);
            }
          }
          return {
            id: f.id,
            name: f.name ?? "(unnamed)",
            size: f.size ?? 0,
            type: f.type ?? "application/octet-stream",
            state: previous?.state ?? "idle",
            publicId: previous?.publicId ?? null,
            error: previous?.error ?? null,
            terminalAsset: previous?.terminalAsset ?? null,
            previewUrl,
          };
        });
        return [...fromUppy, ...ghosts];
      });
    }
    function onConfirm(ev: Event): void {
      const detail = (ev as CustomEvent<IFileConfirmedEventDetail>).detail;
      setFiles((prev) =>
        prev.map((f) =>
          f.id === detail.fileId ? { ...f, state: "uploading", publicId: detail.publicId } : f,
        ),
      );
    }
    function onProcessing(ev: Event): void {
      const detail = (ev as CustomEvent<IFileProcessingEventDetail>).detail;
      setFiles((prev) =>
        prev.map((f) =>
          f.id === detail.fileId ? { ...f, state: "processing", publicId: detail.publicId } : f,
        ),
      );
    }
    function onReady(ev: Event): void {
      const detail = (ev as CustomEvent<IFileReadyEventDetail>).detail;
      const previewUrls = previewUrlsRef.current;
      // Revoke object URL when file reaches ready state
      const previewUrl = previewUrls.get(detail.fileId);
      if (previewUrl !== undefined) {
        URL.revokeObjectURL(previewUrl);
        previewUrls.delete(detail.fileId);
      }
      setFiles((prev) =>
        prev.map((f) =>
          f.id === detail.fileId
            ? {
                ...f,
                state: "ready",
                publicId: detail.publicId,
                previewUrl: null,
                terminalAsset: detail.asset,
              }
            : f,
        ),
      );
    }
    function onQuarantined(ev: Event): void {
      const detail = (ev as CustomEvent<IFileQuarantinedEventDetail>).detail;
      setFiles((prev) =>
        prev.map((f) =>
          f.id === detail.fileId
            ? {
                ...f,
                state: "quarantined",
                publicId: detail.publicId,
                error: { message: `quarantined: ${detail.kind}`, kind: detail.kind },
                terminalAsset: null,
              }
            : f,
        ),
      );
    }
    function onRejectedTerminal(ev: Event): void {
      const detail = (ev as CustomEvent<IFileRejectedTerminalEventDetail>).detail;
      setFiles((prev) =>
        prev.map((f) =>
          f.id === detail.fileId
            ? {
                ...f,
                state: "rejected",
                publicId: detail.publicId,
                terminalAsset: null,
              }
            : f,
        ),
      );
    }
    function onFail(ev: Event): void {
      const detail = (ev as CustomEvent<IFileFailedEventDetail>).detail;
      const message = detail.error.message;
      // "polling-timeout" and other polling failures get state="failed";
      // other errors (intent creation, etc.) get state="error".
      const isPollingFailure = message === "polling-timeout" || message === "processing_failed";
      setFiles((prev) =>
        prev.map((f) =>
          f.id === detail.fileId
            ? {
                ...f,
                state: isPollingFailure ? "failed" : "error",
                error: { message },
              }
            : f,
        ),
      );
    }
    function onReject(ev: Event): void {
      const detail = (ev as CustomEvent<IFileRestrictionRejectedEventDetail>).detail;
      setRejections((prev) => [
        ...prev,
        {
          id: detail.rejectionId,
          fileName: detail.fileName,
          mimeType: detail.mimeType,
          size: detail.size,
          message: detail.error.message,
        },
      ]);
    }
    function onUploadStart(): void {
      setIsUploading(true);
      // Only files still waiting to upload transition to "uploading".
      // allowMultipleUploadBatches means terminal tiles from earlier batches
      // (ready / quarantined / rejected / failed / error) stay in the list —
      // they must never regress to a spinner (F-K3).
      setFiles((prev) =>
        prev.map((f) =>
          f.state === "idle" || f.state === "preview" ? { ...f, state: "uploading" } : f,
        ),
      );
    }
    function onComplete(): void {
      setIsUploading(false);
    }
    function onError(): void {
      setIsUploading(false);
    }

    uppy.on("file-added", syncFromUppy);
    uppy.on("file-removed", syncFromUppy);
    uppy.on("upload", onUploadStart);
    uppy.on("complete", onComplete);
    uppy.on("error", onError);
    manager.addEventListener("file-confirmed", onConfirm);
    manager.addEventListener("file-processing", onProcessing);
    manager.addEventListener("file-ready", onReady);
    manager.addEventListener("file-quarantined", onQuarantined);
    manager.addEventListener("file-rejected-terminal", onRejectedTerminal);
    manager.addEventListener("file-failed", onFail);
    manager.addEventListener("file-restriction-rejected", onReject);

    return (): void => {
      uppy.off("file-added", syncFromUppy);
      uppy.off("file-removed", syncFromUppy);
      uppy.off("upload", onUploadStart);
      uppy.off("complete", onComplete);
      uppy.off("error", onError);
      manager.removeEventListener("file-confirmed", onConfirm);
      manager.removeEventListener("file-processing", onProcessing);
      manager.removeEventListener("file-ready", onReady);
      manager.removeEventListener("file-quarantined", onQuarantined);
      manager.removeEventListener("file-rejected-terminal", onRejectedTerminal);
      manager.removeEventListener("file-failed", onFail);
      manager.removeEventListener("file-restriction-rejected", onReject);
      for (const url of previewUrls.values()) {
        URL.revokeObjectURL(url);
      }
      previewUrls.clear();
    };
  }, [manager]);

  // Sync restrictions when they change. We re-stringify to compare so callers
  // don't need to memoize the object identity themselves — restrictions are
  // typically derived from a fetched policy and recomputed on every render.
  const restrictionsKey = JSON.stringify(opts.restrictions ?? {});
  useEffect(() => {
    manager.setRestrictions(opts.restrictions ?? {});
    // restrictionsKey is the serialized identity we actually care about;
    // opts.restrictions itself changes identity every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manager, restrictionsKey]);

  const addFiles = useCallback((toAdd: File[]) => manager.addFiles(toAdd), [manager]);
  const removeFile = useCallback(
    (id: string) => {
      manager.removeFile(id);
      // Drop ghost-errored files (already removed from Uppy after intent
      // failure) directly from React state and revoke their preview URL.
      const previewUrls = previewUrlsRef.current;
      const url = previewUrls.get(id);
      if (url) {
        URL.revokeObjectURL(url);
        previewUrls.delete(id);
      }
      setFiles((prev) => prev.filter((f) => f.id !== id));
    },
    [manager],
  );
  const dismissRejection = useCallback((id: string): void => {
    setRejections((prev) => prev.filter((r) => r.id !== id));
  }, []);
  const sharedMetadata = opts.sharedMetadata;
  const startUpload = useCallback((): Promise<void> => {
    manager.setSharedMetadata(sharedMetadata ?? {});
    return manager.start();
  }, [manager, sharedMetadata]);

  return { files, rejections, dismissRejection, addFiles, removeFile, startUpload, isUploading };
}
