/**
 * Domain port for minting fully-signed preview URLs the browser can fetch
 * directly. Implementations live in the infrastructure layer (e.g. an
 * imgproxy adapter) and own all signing/HMAC concerns.
 */

export interface IPreviewSpec {
  width: number | null;
  height: number | null;
  fit: string | null;
  format: string | null;
  quality: number | null;
  dpr: number | null;
}

export interface ISignPreviewInput {
  sourceUrl: string;
  preset: IPreviewSpec;
}

export abstract class PreviewUrlSignerPort {
  /**
   * Returns a fully-signed URL the browser can use as `<img src>`, or null
   * when the signer is not configured (allows graceful degradation in
   * environments without an image-rendering proxy).
   */
  abstract sign(input: ISignPreviewInput): string | null;
}
