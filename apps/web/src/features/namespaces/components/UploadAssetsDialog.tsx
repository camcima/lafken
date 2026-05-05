import { type IUploadDropzoneRenderProps, UploadDropzone } from "@lafken/react";
import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/common/Button";
import { getLafkenClient } from "@/lib/lafken-client";

interface IUploadAssetsDialogProps {
  open: boolean;
  namespaceSlug: string;
  onClose: () => void;
}

export function UploadAssetsDialog({
  open,
  namespaceSlug,
  onClose,
}: IUploadAssetsDialogProps): React.JSX.Element | null {
  const { t } = useTranslation();
  if (!open) return null;
  const client = getLafkenClient();

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label={t("pages.namespaces.assets.upload.dialogTitle")}
    >
      <div className="bg-background w-full max-w-xl rounded-lg p-6 shadow-lg">
        <h2 className="mb-4 text-[16px] font-semibold">
          {t("pages.namespaces.assets.upload.dialogTitle")}
        </h2>

        <UploadDropzone
          client={client}
          namespaceSlug={namespaceSlug}
          accept="image/*"
          render={(renderProps) => <DialogBody renderProps={renderProps} onClose={onClose} />}
        />
      </div>
    </div>
  );
}

interface IDialogBodyProps {
  renderProps: IUploadDropzoneRenderProps;
  onClose: () => void;
}

function DialogBody({ renderProps, onClose }: IDialogBodyProps): React.JSX.Element {
  const { t } = useTranslation();
  const { files, isUploading, startUpload, getInputProps, getRootProps } = renderProps;
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (!hasStartedRef.current || isUploading || files.length === 0) return;
    if (files.every((file) => file.state === "uploaded")) {
      onClose();
    }
  }, [files, isUploading, onClose]);

  function handleStart(): void {
    hasStartedRef.current = true;
    void startUpload();
  }

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className="border-border bg-secondary/20 grid place-items-center rounded-md border-2 border-dashed px-6 py-10 text-center"
      >
        <p className="text-muted-foreground text-[12.5px]">
          {t("pages.namespaces.assets.upload.dropzonePrompt")}
        </p>
        <input className="mt-2" {...getInputProps()} />
      </div>

      <ul className="space-y-1">
        {files.map((file) => (
          <li key={file.id} className="flex items-center gap-3 text-[12px]">
            <span className="flex-1 font-mono">{file.name}</span>
            <span className="font-mono text-[11px]">
              {t(`pages.namespaces.assets.upload.fileState${capitalize(file.state)}`)}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          {t("pages.namespaces.assets.upload.cancelButton")}
        </Button>
        <Button variant="indigo" disabled={files.length === 0 || isUploading} onClick={handleStart}>
          {t("pages.namespaces.assets.upload.startButton")}
        </Button>
      </div>
    </div>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
