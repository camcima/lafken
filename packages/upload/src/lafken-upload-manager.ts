import type { LafkenClient } from "@lafken/client";
import Uppy, { type UppyFile } from "@uppy/core";
import XHRUpload from "@uppy/xhr-upload";

export interface ILafkenUploadManagerOptions {
  client: LafkenClient;
  namespaceSlug: string;
}

export interface IFileConfirmedEventDetail {
  fileId: string;
  publicId: string;
}

export interface IFileFailedEventDetail {
  fileId: string;
  error: Error;
}

type AnyMeta = Record<string, unknown>;
type AnyBody = Record<string, never>;

export class LafkenUploadManager extends EventTarget {
  private readonly uppy: Uppy<AnyMeta, AnyBody>;
  private readonly publicIdByFileId = new Map<string, string>();

  constructor(private readonly opts: ILafkenUploadManagerOptions) {
    super();
    this.uppy = new Uppy<AnyMeta, AnyBody>({
      autoProceed: false,
      allowMultipleUploadBatches: true,
    });

    this.uppy.use(XHRUpload, {
      endpoint: "placeholder",
      method: "PUT",
      formData: false,
    });

    // Pre-processor: call createUploadIntent per file and store the upload URL/headers
    // as per-file xhrUpload overrides before the upload starts.
    this.uppy.addPreProcessor(async (fileIds: string[]) => {
      await Promise.all(
        fileIds.map(async (fileId) => {
          const file = this.uppy.getFile(fileId);
          if (!file) return;

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
        }),
      );
    });

    this.uppy.on("complete", (result) => {
      void this.confirmCompletedFiles(result.successful ?? []);
    });
  }

  addFiles(files: File[]): void {
    for (const file of files) {
      this.uppy.addFile({
        name: file.name,
        type: file.type,
        data: file,
        source: "lafken-upload",
      });
    }
  }

  removeFile(fileId: string): void {
    this.uppy.removeFile(fileId);
    this.publicIdByFileId.delete(fileId);
  }

  async start(): Promise<void> {
    await this.uppy.upload();
  }

  cancelAll(): void {
    this.uppy.cancelAll();
    this.publicIdByFileId.clear();
  }

  getUppy(): Uppy<AnyMeta, AnyBody> {
    return this.uppy;
  }

  private async confirmCompletedFiles(
    successful: ReadonlyArray<UppyFile<AnyMeta, AnyBody>>,
  ): Promise<void> {
    for (const file of successful) {
      const publicId = this.publicIdByFileId.get(file.id);
      if (!publicId) continue;
      try {
        await this.opts.client.confirmUpload(publicId);
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
