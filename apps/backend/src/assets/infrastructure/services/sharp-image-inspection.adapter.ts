import { createHash } from "node:crypto";

import * as exifr from "exifr";
import sharp from "sharp";

import { calculateDurationMs } from "@/assets/application/processing/processing-evidence";
import {
  type IImageInspectionInput,
  type IImageInspectionResult,
  ImageInspectionPort,
} from "@/assets/domain/services/image-inspection.service.port";

import { normalizeExif } from "./exif-normalizer";

const FORMAT_TO_MIME: Record<string, string> = {
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  tiff: "image/tiff",
};

const ANALYZER_NAME = "image_inspection";
const ADAPTER_NAME = "sharp-image-inspection";
const ADAPTER_VERSION = "sharp-v1";

export class SharpImageInspectionAdapter extends ImageInspectionPort {
  async inspect(input: IImageInspectionInput): Promise<IImageInspectionResult> {
    const startedAt: Date = new Date();
    const contentHash: Buffer = createHash("sha256").update(input.bytes).digest();

    try {
      const metadata: sharp.Metadata = await sharp(input.bytes).metadata();
      const format: string | null = metadata.format ?? null;
      const actualMimeType: string | null = format ? (FORMAT_TO_MIME[format] ?? null) : null;

      if (!actualMimeType) {
        return this.errorResult(input, startedAt, contentHash, "unrecognized_format", null, format);
      }
      if (!input.allowedMimeTypes.includes(actualMimeType)) {
        return this.errorResult(
          input,
          startedAt,
          contentHash,
          "mime_type_not_allowed",
          actualMimeType,
          format,
        );
      }

      const rawExif: unknown = await exifr.parse(input.bytes).catch((): null => null);
      const captureContext: Record<string, unknown> | null = normalizeExif(
        rawExif as Record<string, unknown> | null,
      );
      const finishedAt: Date = new Date();

      return {
        decision: "pass",
        reason: null,
        actualMimeType,
        format,
        sizeBytes: BigInt(input.bytes.length),
        width: metadata.width ?? null,
        height: metadata.height ?? null,
        contentHash,
        captureContext,
        analyzer: ANALYZER_NAME,
        analyzerVersion: ADAPTER_VERSION,
        findings: {
          step: ANALYZER_NAME,
          adapter: ADAPTER_NAME,
          adapter_version: ADAPTER_VERSION,
          declared_mime_type: input.declaredMimeType,
          actual_mime_type: actualMimeType,
          format,
          width: metadata.width ?? null,
          height: metadata.height ?? null,
          size_bytes: input.bytes.length,
          content_hash_hex: contentHash.toString("hex"),
          capture_context: captureContext,
          started_at: startedAt.toISOString(),
          finished_at: finishedAt.toISOString(),
          duration_ms: calculateDurationMs(startedAt, finishedAt),
        },
      };
    } catch {
      return this.errorResult(input, startedAt, contentHash, "invalid_image_format", null, null);
    }
  }

  private errorResult(
    input: IImageInspectionInput,
    startedAt: Date,
    contentHash: Buffer,
    reason: string,
    actualMimeType: string | null,
    format: string | null,
  ): IImageInspectionResult {
    const finishedAt: Date = new Date();
    return {
      decision: "error",
      reason,
      actualMimeType,
      format,
      sizeBytes: BigInt(input.bytes.length),
      width: null,
      height: null,
      contentHash,
      captureContext: null,
      analyzer: ANALYZER_NAME,
      analyzerVersion: ADAPTER_VERSION,
      findings: {
        step: ANALYZER_NAME,
        adapter: ADAPTER_NAME,
        adapter_version: ADAPTER_VERSION,
        declared_mime_type: input.declaredMimeType,
        actual_mime_type: actualMimeType,
        format,
        reason,
        size_bytes: input.bytes.length,
        content_hash_hex: contentHash.toString("hex"),
        started_at: startedAt.toISOString(),
        finished_at: finishedAt.toISOString(),
        duration_ms: calculateDurationMs(startedAt, finishedAt),
      },
    };
  }
}
