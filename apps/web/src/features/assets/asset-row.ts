import type { AssetResponseDTO } from "@shared/backend-api";

import type { DemoAsset } from "@/lib/demo/lafken-demo-data";

export interface IAssetRow {
  /** Stable React key + selection key. */
  rowKey: string;
  /** Internal id (uuidv7) — used for admin URLs (`/assets/$id`) and admin BE calls. */
  id: string;
  /** External publicId (uuidv4) — what's displayed to humans (header, copy chip, list). */
  publicId: string;
  /** Short id for display (~8 chars). */
  shortId: string;
  state: AssetResponseDTO["state"];
  namespaceSlug: string;
  /** ISO timestamp of upload (best-effort). */
  uploadedAt: string;
  /** Minutes since upload, for fmtMinAgo. */
  minutesAgo: number;
  uploadedBy: string;
  uploadedDisplay: string;
  sizeBytes: number;
  /** Format derived from mimeType when available, e.g. "JPG", "PNG". */
  format: string;
  /** Human dimensions like "1024×768" or empty string when unknown. */
  dimensions: string;
  /** 0-360 hue for the thumbnail gradient (deterministic). */
  thumbHue: number;
  legalHold: boolean;
  /** Demo-only fields; empty string when not available. */
  tail: string;
  wo: string;
}

const HUE_DEGREES = 360;
const HASH_PRIME = 31;

function hashHue(seed: string): number {
  let acc = 0;
  for (let i = 0; i < seed.length; i += 1) {
    acc = (acc * HASH_PRIME + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(acc) % HUE_DEGREES;
}

function mimeToFormat(mime: string | undefined): string {
  if (!mime) return "—";
  const subtype = mime.split("/")[1] ?? "";
  if (!subtype) return "—";
  if (subtype === "jpeg") return "JPG";
  return subtype.toUpperCase();
}

function formatDimensions(width: number | undefined, height: number | undefined): string {
  if (width === undefined || height === undefined) return "";
  return `${width}×${height}`;
}

const MS_PER_MIN = 60_000;

function minutesSince(iso: string | undefined): number {
  if (!iso) return 0;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / MS_PER_MIN));
}

const SHORT_ID_LENGTH = 8;

export function assetResponseToRow(dto: AssetResponseDTO): IAssetRow {
  const uploadedAt: string = dto.confirmedAt ?? dto.createdAt;
  return {
    rowKey: dto.id,
    id: dto.id,
    publicId: dto.publicId,
    shortId: dto.publicId.slice(0, SHORT_ID_LENGTH),
    state: dto.state,
    namespaceSlug: dto.namespaceSlug,
    uploadedAt,
    minutesAgo: minutesSince(uploadedAt),
    uploadedBy: dto.uploadedBy ?? "—",
    uploadedDisplay: dto.uploadedBy ?? "—",
    sizeBytes: dto.sizeBytes ?? 0,
    format: mimeToFormat(dto.mimeType ?? dto.declaredMimeType),
    dimensions: formatDimensions(dto.width, dto.height),
    thumbHue: hashHue(dto.publicId),
    legalHold: dto.legalHold,
    tail: "",
    wo: "",
  };
}

export function demoAssetToRow(demo: DemoAsset): IAssetRow {
  return {
    rowKey: demo.id,
    id: demo.id,
    publicId: demo.publicId,
    shortId: demo.id,
    state: demo.state,
    namespaceSlug: demo.namespace,
    uploadedAt: "",
    minutesAgo: demo.minutesAgo,
    uploadedBy: demo.uploadedBy,
    uploadedDisplay: demo.uploadedDisplay,
    sizeBytes: demo.sizeBytes,
    format: demo.format,
    dimensions: demo.dimensions,
    thumbHue: demo.thumbHue,
    legalHold: demo.hasLegalHold,
    tail: demo.tail,
    wo: demo.wo,
  };
}
