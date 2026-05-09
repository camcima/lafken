export interface IImageInspectionInput {
  bytes: Buffer;
  declaredMimeType: string | null;
  sniffedMimeType: string;
  allowedMimeTypes: string[];
}

export interface IImageInspectionResult {
  decision: "pass" | "error";
  reason: string | null;
  actualMimeType: string | null;
  format: string | null;
  sizeBytes: bigint;
  width: number | null;
  height: number | null;
  contentHash: Buffer;
  captureContext: Record<string, unknown> | null;
  findings: Record<string, unknown>;
  analyzer: string;
  analyzerVersion: string | null;
}

export abstract class ImageInspectionPort {
  abstract inspect(input: IImageInspectionInput): Promise<IImageInspectionResult>;
}
