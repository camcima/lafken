export type UploadProtocol = "simple" | "tus";

export interface ICreateUploadIntentInput {
  namespaceSlug: string;
  declaredMimeType: string;
  declaredSizeBytes: number;
  protocol?: UploadProtocol;
}

export interface ICreateUploadIntentResult {
  publicId: string;
  protocol: UploadProtocol;
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
  expiresAt: string;
}

export interface IRefreshUploadUrlResult {
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
  expiresAt: string;
}

export interface IConfirmUploadOptions {
  width?: number;
  height?: number;
}

export interface IAsset {
  publicId: string;
  namespaceSlug: string;
  state: string;
  storageKey: string;
  declaredMimeType: string | null;
  sizeBytes: number | null;
  uploadedBy: string | null;
  confirmedAt: string | null;
  createdAt: string;
  /**
   * Map of preset name to a fully-signed preview URL the browser can fetch
   * directly. Empty when no presets are active or no signer is configured.
   */
  previewUrls?: Record<string, string>;
}

export interface IProblemDetails {
  type?: string;
  status?: number;
  title?: string;
  detail?: string;
  [key: string]: unknown;
}

export class LafkenApiError extends Error {
  public readonly status: number;
  public readonly problemDetails: IProblemDetails | null;

  constructor(props: { status: number; problemDetails: IProblemDetails | null; message: string }) {
    super(props.message);
    this.name = "LafkenApiError";
    this.status = props.status;
    this.problemDetails = props.problemDetails;
  }
}

export interface ILafkenClientOptions {
  baseUrl: string;
  getAuthToken?: () => Promise<string | null>;
}
