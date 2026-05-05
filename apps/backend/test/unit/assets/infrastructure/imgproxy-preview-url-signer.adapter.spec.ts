import { describe, expect, it } from "vitest";

import { ImgproxyPreviewUrlSigner } from "@/assets/infrastructure/services/imgproxy-preview-url-signer.adapter";
import { NoopPreviewUrlSigner } from "@/assets/infrastructure/services/noop-preview-url-signer.adapter";

const KEY_HEX = "943b421c4e44c4f24c4f24c4f24c4f24c4f24c4f24c4f24c4f24c4f24c4f24c4";
const SALT_HEX = "520b421c4e44c4f24c4f24c4f24c4f24c4f24c4f24c4f24c4f24c4f24c4f24c4";

function makeSigner(): ImgproxyPreviewUrlSigner {
  return new ImgproxyPreviewUrlSigner({
    baseUrl: "https://imgproxy.test",
    keyHex: KEY_HEX,
    saltHex: SALT_HEX,
    signatureSize: 32,
  });
}

describe("ImgproxyPreviewUrlSigner", () => {
  it("produces a stable signed URL for the same input", () => {
    const signer = makeSigner();
    const url1 = signer.sign({
      sourceUrl: "http://fake-gcs:4443/lafken-dev/test/assets/abc/source",
      preset: { fit: "fit", width: 200, height: 200, format: "webp", quality: 80, dpr: null },
    });
    const url2 = signer.sign({
      sourceUrl: "http://fake-gcs:4443/lafken-dev/test/assets/abc/source",
      preset: { fit: "fit", width: 200, height: 200, format: "webp", quality: 80, dpr: null },
    });
    expect(url1).toBe(url2);
    const expectedB64 = Buffer.from(
      "http://fake-gcs:4443/lafken-dev/test/assets/abc/source",
      "utf8",
    ).toString("base64url");
    expect(url1).toMatch(
      new RegExp(
        `^https://imgproxy\\.test/[A-Za-z0-9_-]+/rs:fit:200:200/q:80/${expectedB64}\\.webp$`,
        "u",
      ),
    );
  });

  it("produces different URLs when preset changes", () => {
    const signer = makeSigner();
    const sourceUrl = "http://fake-gcs:4443/lafken-dev/x/source";
    const url1 = signer.sign({
      sourceUrl,
      preset: { fit: "fit", width: 100, height: null, format: null, quality: null, dpr: null },
    });
    const url2 = signer.sign({
      sourceUrl,
      preset: { fit: "fit", width: 200, height: null, format: null, quality: null, dpr: null },
    });
    expect(url1).not.toBe(url2);
  });

  it("translates 'cover' fit to imgproxy 'fill'", () => {
    const signer = makeSigner();
    const url = signer.sign({
      sourceUrl: "http://fake-gcs:4443/lafken-dev/x/source",
      preset: { fit: "cover", width: 300, height: 200, format: null, quality: null, dpr: null },
    });
    expect(url).toContain("/rs:fill:300:200/");
  });

  it("translates 'contain' fit to imgproxy 'fit'", () => {
    const signer = makeSigner();
    const url = signer.sign({
      sourceUrl: "http://fake-gcs:4443/lafken-dev/x/source",
      preset: { fit: "contain", width: 300, height: 200, format: null, quality: null, dpr: null },
    });
    expect(url).toContain("/rs:fit:300:200/");
  });

  it("appends the format suffix at the very end", () => {
    const signer = makeSigner();
    const url = signer.sign({
      sourceUrl: "http://fake-gcs:4443/lafken-dev/x/source",
      preset: { fit: "fit", width: 100, height: 100, format: "avif", quality: null, dpr: null },
    });
    expect(url.endsWith(".avif")).toBe(true);
  });

  it("appends a dpr option when set", () => {
    const signer = makeSigner();
    const url = signer.sign({
      sourceUrl: "http://fake-gcs:4443/lafken-dev/x/source",
      preset: { fit: "fit", width: 100, height: 100, format: null, quality: null, dpr: 2 },
    });
    expect(url).toContain("/dpr:2/");
  });

  it("trims trailing slashes off the base URL", () => {
    const signer = new ImgproxyPreviewUrlSigner({
      baseUrl: "https://imgproxy.test///",
      keyHex: KEY_HEX,
      saltHex: SALT_HEX,
      signatureSize: 32,
    });
    const url = signer.sign({
      sourceUrl: "http://fake-gcs:4443/lafken-dev/x/source",
      preset: { fit: "fit", width: 100, height: 100, format: null, quality: null, dpr: null },
    });
    expect(url.startsWith("https://imgproxy.test/")).toBe(true);
    expect(url.startsWith("https://imgproxy.test//")).toBe(false);
  });
});

describe("NoopPreviewUrlSigner", () => {
  it("returns null from sign()", () => {
    const signer = new NoopPreviewUrlSigner();
    expect(
      signer.sign({
        sourceUrl: "http://fake-gcs:4443/lafken-dev/x/source",
        preset: { fit: null, width: null, height: null, format: null, quality: null, dpr: null },
      }),
    ).toBeNull();
  });
});
