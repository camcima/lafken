import type { LafkenClient } from "@lafken/client";
import React, { useCallback, useState } from "react";

import { type IUseImageUploadResult, useImageUpload } from "./use-image-upload";

export interface IUploadDropzoneRenderProps {
  files: IUseImageUploadResult["files"];
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
  accept?: string;
  multiple?: boolean;
  render: (props: IUploadDropzoneRenderProps) => React.ReactNode;
}

export function UploadDropzone(props: IUploadDropzoneProps): React.JSX.Element {
  const { files, addFiles, removeFile, startUpload, isUploading } = useImageUpload({
    client: props.client,
    namespaceSlug: props.namespaceSlug,
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

  const getInputProps = useCallback(
    () => ({
      ref: inputRef,
      type: "file" as const,
      accept: props.accept,
      multiple: props.multiple ?? true,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const list = e.target.files ? Array.from(e.target.files) : [];
        if (list.length > 0) addFiles(list);
        e.target.value = "";
      },
    }),
    [addFiles, props.accept, props.multiple],
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
