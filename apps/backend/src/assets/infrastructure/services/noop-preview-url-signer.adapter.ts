import {
  type ISignPreviewInput,
  PreviewUrlSignerPort,
} from "@/assets/domain/services/preview-url-signer.port";

/**
 * No-op implementation used when imgproxy is not configured. Returns null
 * from `sign()` so callers can detect the absence of preview URLs without
 * special-casing the wiring.
 */
export class NoopPreviewUrlSigner extends PreviewUrlSignerPort {
  sign(_input: ISignPreviewInput): null {
    return null;
  }
}
