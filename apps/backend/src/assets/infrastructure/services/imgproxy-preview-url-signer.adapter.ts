import { createHmac } from "node:crypto";

import {
  type IPreviewSpec,
  type ISignPreviewInput,
  PreviewUrlSignerPort,
} from "@/assets/domain/services/preview-url-signer.port";

export interface IImgproxyOptions {
  /** Browser-facing imgproxy origin, e.g. http://localhost:8081. */
  baseUrl: string;
  /** Hex-encoded HMAC-SHA256 key shared with imgproxy. */
  keyHex: string;
  /** Hex-encoded HMAC-SHA256 salt shared with imgproxy. */
  saltHex: string;
  /**
   * Number of bytes to keep from the HMAC digest before base64-encoding.
   * Match imgproxy's IMGPROXY_SIGNATURE_SIZE (default 32, i.e. full digest).
   */
  signatureSize: number;
}

/**
 * Mints fully-signed imgproxy URLs of the form:
 *
 *   <base>/<sig>/<processing-options>/<base64url-source>[@<format>]
 *
 * where <sig> is the base64-urlsafe HMAC-SHA256 of (salt || path) truncated
 * to `signatureSize` bytes, and <path> is the leading slash plus everything
 * after it. The source URL is base64url-encoded rather than placed under
 * /plain/ so query strings (e.g. `?alt=media`) don't collide with HTTP URL
 * parsing on the imgproxy side.
 *
 * See https://docs.imgproxy.net/usage/signing_url
 */
export class ImgproxyPreviewUrlSigner extends PreviewUrlSignerPort {
  private readonly key: Buffer;
  private readonly salt: Buffer;
  private readonly baseUrl: string;
  private readonly signatureSize: number;

  constructor(options: IImgproxyOptions) {
    super();
    this.key = Buffer.from(options.keyHex, "hex");
    this.salt = Buffer.from(options.saltHex, "hex");
    this.baseUrl = options.baseUrl.replace(/\/+$/u, "");
    this.signatureSize = options.signatureSize;
  }

  sign(input: ISignPreviewInput): string {
    const options: string = this.buildProcessingOptions(input.preset);
    const sourceB64: string = Buffer.from(input.sourceUrl, "utf8").toString("base64url");
    // For base64-encoded source URLs imgproxy expects the format extension as
    // `.ext`, not the plain-style `@ext` suffix. The Lafken preset value
    // `auto` means "no explicit output format" — emit no extension so imgproxy
    // serves the source format (subject to its own auto-format negotiation).
    const explicitFormat: boolean =
      input.preset.format !== null &&
      input.preset.format !== undefined &&
      input.preset.format !== "auto";
    const formatSuffix: string = explicitFormat ? `.${input.preset.format ?? ""}` : "";
    const path: string = `/${options}/${sourceB64}${formatSuffix}`;
    const hmac = createHmac("sha256", this.key);
    hmac.update(this.salt);
    hmac.update(path);
    const signature: string = hmac.digest().subarray(0, this.signatureSize).toString("base64url");
    return `${this.baseUrl}/${signature}${path}`;
  }

  private buildProcessingOptions(preset: IPreviewSpec): string {
    const parts: string[] = [];
    const fit: string = mapFit(preset.fit);
    if (preset.width !== null && preset.height !== null) {
      parts.push(`rs:${fit}:${preset.width}:${preset.height}`);
    } else if (preset.width !== null) {
      parts.push(`rs:${fit}:${preset.width}:0`);
    } else if (preset.height !== null) {
      parts.push(`rs:${fit}:0:${preset.height}`);
    }
    if (preset.quality !== null) {
      parts.push(`q:${preset.quality}`);
    }
    if (preset.dpr !== null) {
      parts.push(`dpr:${preset.dpr}`);
    }
    return parts.length === 0 ? `rs:${fit}` : parts.join("/");
  }
}

/**
 * Translates Lafken preset fit values into imgproxy resizing types.
 * Imgproxy supports: fit, fill, fill-down, force, auto.
 */
function mapFit(fit: string | null | undefined): string {
  switch (fit) {
    case "cover":
    case "fill":
      return "fill";
    case "outside":
      return "fill-down";
    case "force":
      return "force";
    case "auto":
      return "auto";
    case "contain":
    case "inside":
    default:
      return "fit";
  }
}
