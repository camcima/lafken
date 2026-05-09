import type { LafkenClient } from "@lafken/client";
import type { ISharedUploadMetadata, IUploadRestrictions } from "@lafken/upload";
import React, { useCallback, useState } from "react";

import { type IUseImageUploadResult, useImageUpload } from "./use-image-upload";

export interface IUploadDropzoneRenderProps {
  files: IUseImageUploadResult["files"];
  rejections: IUseImageUploadResult["rejections"];
  dismissRejection: IUseImageUploadResult["dismissRejection"];
  isDragOver: boolean;
  isUploading: boolean;
  startUpload: () => Promise<void>;
  removeFile: (id: string) => void;
  getInputProps: () => React.InputHTMLAttributes<HTMLInputElement> & {
    ref: React.Ref<HTMLInputElement>;
  };
  getRootProps: () => React.HTMLAttributes<HTMLDivElement>;
}

export interface IUploadDropzoneProps {
  client: LafkenClient;
  namespaceSlug: string;
  /**
   * HTML `accept` attribute for the file picker (a UX hint only — does not
   * enforce). For enforcement, use `restrictions.allowedFileTypes`. If
   * omitted and `restrictions.allowedFileTypes` is set, the picker filter is
   * derived from the restriction.
   */
  accept?: string;
  multiple?: boolean;
  /**
   * Shared metadata to apply to every confirmed upload in the next batch.
   * Read at `startUpload` time, so callers can mutate it freely between batches.
   */
  sharedMetadata?: ISharedUploadMetadata;
  /**
   * File-level restrictions (allowed types, max size, etc.) enforced at drop
   * time. Disallowed files are surfaced via `rejections` and never enter the
   * upload queue.
   */
  restrictions?: IUploadRestrictions;
  /** Upload protocol to use. Default: "simple" (XHR PUT). */
  protocol?: "simple" | "tus";
  /**
   * Ms before `expiresAt` at which to pre-flight a URL refresh. Default 30000.
   */
  refreshSafetyMarginMs?: number;
  render: (props: IUploadDropzoneRenderProps) => React.ReactNode;
}

export function UploadDropzone(props: IUploadDropzoneProps): React.JSX.Element {
  const { files, rejections, dismissRejection, addFiles, removeFile, startUpload, isUploading } =
    useImageUpload({
      client: props.client,
      namespaceSlug: props.namespaceSlug,
      sharedMetadata: props.sharedMetadata,
      restrictions: props.restrictions,
      protocol: props.protocol,
      refreshSafetyMarginMs: props.refreshSafetyMarginMs,
    });
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragOver(false);
      const dropped = Array.from(event.dataTransfer.files);
      if (dropped.length > 0) addFiles(dropped);
    },
    [addFiles],
  );

  // Auto-derive the picker filter from restrictions when the consumer didn't
  // pass an explicit `accept`. Saves callers the boilerplate of joining the
  // same array a second time.
  const derivedAccept: string | undefined =
    props.accept ?? props.restrictions?.allowedFileTypes?.join(",");

  const getInputProps = useCallback(
    () => ({
      ref: inputRef,
      type: "file" as const,
      accept: derivedAccept,
      multiple: props.multiple ?? true,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const list = e.target.files ? Array.from(e.target.files) : [];
        if (list.length > 0) addFiles(list);
        e.target.value = "";
      },
    }),
    [addFiles, derivedAccept, props.multiple],
  );

  const getRootProps = useCallback(
    () => ({
      onDragEnter: (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
      },
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
      },
      onDragLeave: () => {
        setIsDragOver(false);
      },
      onDrop,
    }),
    [onDrop],
  );

  return (
    <>
      {props.render({
        files,
        rejections,
        dismissRejection,
        isDragOver,
        isUploading,
        startUpload,
        removeFile,
        getInputProps,
        getRootProps,
      })}
    </>
  );
}
