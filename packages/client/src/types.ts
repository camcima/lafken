export interface ICreateUploadIntentInput {
  namespaceSlug: string;
  declaredMimeType: string;
  declaredSizeBytes: number;
}

export interface ICreateUploadIntentResult {
  publicId: string;
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
