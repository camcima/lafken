import { describe, expect, it } from "vitest";

import { normalizeExif } from "@/assets/infrastructure/services/exif-normalizer";

describe("normalizeExif", () => {
  it("normalizes capture date, location, device, camera, and remaining exif data", () => {
    const result = normalizeExif({
      DateTimeOriginal: "2026:05:06 10:11:12",
      latitude: -33.4489,
      longitude: -70.6693,
      GPSAltitude: 520,
      Make: "Canon",
      Model: "EOS R5",
      LensModel: "RF24-70mm F2.8",
      SerialNumber: "abc123",
      ExposureTime: 0.008,
      FNumber: 2.8,
      ISO: 400,
      FocalLength: 35,
      Orientation: 1,
      Artist: "Maintenance Team",
    });

    expect(result).toEqual({
      captured_at: "2026-05-06T10:11:12.000Z",
      capture_location: {
        lat: -33.4489,
        lng: -70.6693,
        altitude_m: 520,
      },
      device: {
        make: "Canon",
        model: "EOS R5",
        lens_model: "RF24-70mm F2.8",
        serial_number: "abc123",
      },
      camera: {
        exposure_time: "1/125",
        f_number: 2.8,
        iso: 400,
        focal_length_mm: 35,
        orientation: 1,
      },
      exif_data: {
        Artist: "Maintenance Team",
      },
    });
  });

  it("returns null when no EXIF fields are present", () => {
    expect(normalizeExif(null)).toBeNull();
    expect(normalizeExif({})).toBeNull();
  });
});
