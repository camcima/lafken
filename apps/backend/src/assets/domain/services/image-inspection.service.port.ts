import type { NamespacePolicy } from "@/namespaces/domain/entities/namespace-policy.entity";

export interface IImageInspectionInput {
  bytes: Buffer;
  declaredMimeType: string | null;
  policy: NamespacePolicy;
}

export interface IImageInspectionResult {
  actualMimeType: string | null;
  format: string | null;
  sizeBytes: bigint;
  width: number | null;
  height: number | null;
  contentHash: Buffer;
  captureContext: Record<string, unknown> | null;
  exifData: Record<string, unknown> | null;
  decision: "pass" | "reject";
  reason: string | null;
  adapter: string;
  adapterVersion: string | null;
  findings: Record<string, unknown>;
}

export abstract class ImageInspectionPort {
  abstract inspect(input: IImageInspectionInput): Promise<IImageInspectionResult>;
}
