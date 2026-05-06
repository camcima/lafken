const NORMALIZED_KEYS: Set<string> = new Set([
  "DateTimeOriginal",
  "CreateDate",
  "ModifyDate",
  "latitude",
  "longitude",
  "GPSLatitude",
  "GPSLongitude",
  "GPSAltitude",
  "Make",
  "Model",
  "LensModel",
  "SerialNumber",
  "ExposureTime",
  "FNumber",
  "ISO",
  "FocalLength",
  "Orientation",
]);

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function parseExifDate(value: unknown): string | undefined {
  if (value instanceof Date) {
    return value.toISOString();
  }

  const raw: string | undefined = asString(value);
  if (!raw) {
    return undefined;
  }

  const normalized: string = raw.replace(/^(\d{4}):(\d{2}):(\d{2}) /u, "$1-$2-$3T");
  const date: Date = new Date(normalized.endsWith("Z") ? normalized : `${normalized}Z`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function exposureToString(value: unknown): string | undefined {
  const exposure: number | undefined = asNumber(value);
  if (exposure === undefined) {
    return undefined;
  }
  if (exposure > 0 && exposure < 1) {
    return `1/${String(Math.round(1 / exposure))}`;
  }
  return String(exposure);
}

function toJsonSafe(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Buffer.isBuffer(value)) {
    return value.toString("base64");
  }
  if (Array.isArray(value)) {
    return value.map((item: unknown): unknown => toJsonSafe(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(
        ([key, child]: [string, unknown]): [string, unknown] => [key, toJsonSafe(child)],
      ),
    );
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return value;
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  return null;
}

export function normalizeExif(raw: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!raw || Object.keys(raw).length === 0) {
    return null;
  }

  const capturedAt: string | undefined =
    parseExifDate(raw["DateTimeOriginal"]) ??
    parseExifDate(raw["CreateDate"]) ??
    parseExifDate(raw["ModifyDate"]);
  const lat: number | undefined = asNumber(raw["latitude"]) ?? asNumber(raw["GPSLatitude"]);
  const lng: number | undefined = asNumber(raw["longitude"]) ?? asNumber(raw["GPSLongitude"]);
  const altitude: number | undefined = asNumber(raw["GPSAltitude"]);
  const make: string | undefined = asString(raw["Make"]);
  const model: string | undefined = asString(raw["Model"]);
  const lensModel: string | undefined = asString(raw["LensModel"]);
  const serialNumber: string | undefined = asString(raw["SerialNumber"]);
  const exposureTime: string | undefined = exposureToString(raw["ExposureTime"]);
  const fNumber: number | undefined = asNumber(raw["FNumber"]);
  const iso: number | undefined = asNumber(raw["ISO"]);
  const focalLength: number | undefined = asNumber(raw["FocalLength"]);
  const orientation: number | undefined = asNumber(raw["Orientation"]);

  const device: Record<string, unknown> = {
    ...(make ? { make } : {}),
    ...(model ? { model } : {}),
    ...(lensModel ? { lens_model: lensModel } : {}),
    ...(serialNumber ? { serial_number: serialNumber } : {}),
  };
  const camera: Record<string, unknown> = {
    ...(exposureTime ? { exposure_time: exposureTime } : {}),
    ...(fNumber !== undefined ? { f_number: fNumber } : {}),
    ...(iso !== undefined ? { iso } : {}),
    ...(focalLength !== undefined ? { focal_length_mm: focalLength } : {}),
    ...(orientation !== undefined ? { orientation } : {}),
  };
  const exifData: Record<string, unknown> = Object.fromEntries(
    Object.entries(raw)
      .filter(([key]: [string, unknown]): boolean => !NORMALIZED_KEYS.has(key))
      .map(([key, value]: [string, unknown]): [string, unknown] => [key, toJsonSafe(value)]),
  );

  const result: Record<string, unknown> = {
    ...(capturedAt ? { captured_at: capturedAt } : {}),
    ...(lat !== undefined && lng !== undefined
      ? {
          capture_location: {
            lat,
            lng,
            ...(altitude !== undefined ? { altitude_m: altitude } : {}),
          },
        }
      : {}),
    ...(Object.keys(device).length > 0 ? { device } : {}),
    ...(Object.keys(camera).length > 0 ? { camera } : {}),
    ...(Object.keys(exifData).length > 0 ? { exif_data: exifData } : {}),
  };

  return Object.keys(result).length > 0 ? result : null;
}
