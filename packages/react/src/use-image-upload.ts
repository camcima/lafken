import type { LafkenClient } from "@lafken/client";
import {
  type IFileConfirmedEventDetail,
  type IFileFailedEventDetail,
  LafkenUploadManager,
} from "@lafken/upload";
import { useCallback, useEffect, useState } from "react";

export type UploadFileState = "idle" | "uploading" | "uploaded" | "error";

export interface IUploadFile {
  id: string;
  name: string;
  size: number;
  type: string;
  state: UploadFileState;
  publicId: string | null;
  error: string | null;
}

export interface IUseImageUploadOptions {
  client: LafkenClient;
  namespaceSlug: string;
}

export interface IUseImageUploadResult {
  files: IUploadFile[];
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
  const [manager] = useState<LafkenUploadManager>(
    () =>
      new LafkenUploadManager({
        client: opts.client,
        namespaceSlug: opts.namespaceSlug,
      }),
  );
  const [files, setFiles] = useState<IUploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const uppy = manager.getUppy();
    function syncFromUppy(): void {
      const all = uppy.getFiles();
      setFiles((prev) =>
        all.map((f) => {
          const previous = prev.find((p) => p.id === f.id);
          return {
            id: f.id,
            name: f.name ?? "(unnamed)",
            size: f.size ?? 0,
            type: f.type ?? "application/octet-stream",
            state: previous?.state ?? "idle",
            publicId: previous?.publicId ?? null,
            error: previous?.error ?? null,
          };
        }),
      );
    }
    function onConfirm(ev: Event): void {
      const detail = (ev as CustomEvent<IFileConfirmedEventDetail>).detail;
      setFiles((prev) =>
        prev.map((f) =>
          f.id === detail.fileId ? { ...f, state: "uploaded", publicId: detail.publicId } : f,
        ),
      );
    }
    function onFail(ev: Event): void {
      const detail = (ev as CustomEvent<IFileFailedEventDetail>).detail;
      setFiles((prev) =>
        prev.map((f) =>
          f.id === detail.fileId ? { ...f, state: "error", error: detail.error.message } : f,
        ),
      );
    }
    function onUploadStart(): void {
      setIsUploading(true);
      setFiles((prev) => prev.map((f) => ({ ...f, state: "uploading" })));
    }
    function onComplete(): void {
      setIsUploading(false);
    }

    uppy.on("file-added", syncFromUppy);
    uppy.on("file-removed", syncFromUppy);
    uppy.on("upload", onUploadStart);
    uppy.on("complete", onComplete);
    manager.addEventListener("file-confirmed", onConfirm);
    manager.addEventListener("file-failed", onFail);

    return (): void => {
      uppy.off("file-added", syncFromUppy);
      uppy.off("file-removed", syncFromUppy);
      uppy.off("upload", onUploadStart);
      uppy.off("complete", onComplete);
      manager.removeEventListener("file-confirmed", onConfirm);
      manager.removeEventListener("file-failed", onFail);
    };
  }, [manager]);

  const addFiles = useCallback((toAdd: File[]) => manager.addFiles(toAdd), [manager]);
  const removeFile = useCallback((id: string) => manager.removeFile(id), [manager]);
  const startUpload = useCallback(() => manager.start(), [manager]);

  return { files, addFiles, removeFile, startUpload, isUploading };
}
