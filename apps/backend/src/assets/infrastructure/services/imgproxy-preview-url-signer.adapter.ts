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
 *   <base>/<sig>/<processing-options>/plain/<source-url>[@<format>]
 *
 * where <sig> is the base64-urlsafe HMAC-SHA256 of (salt || path) truncated
 * to `signatureSize` bytes, and <path> is the leading slash plus everything
 * after it.
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
    const formatSuffix: string = input.preset.format ? `@${input.preset.format}` : "";
    const path: string = `/${options}/plain/${input.sourceUrl}${formatSuffix}`;
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
