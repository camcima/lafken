import type {
  AssetAnalysisResponseDTO,
  AssetDownloadUrlResponseDTO,
  AssetResponseDTO,
  AssetStateTransitionResponseDTO,
  ConfirmUploadRequestDTO,
  CreateUploadIntentRequestDTO,
  CreateUploadIntentResponseDTO,
  ListAssetsQueryDTO,
  PaginatedResult,
  PreviewUrlResponseDTO,
  ProcessingJobResponseDTO,
  RefreshUploadUrlResponseDTO,
} from "@shared/backend-api";

import type { Transport } from "../transport";

export class AssetsClient {
  constructor(private readonly t: Transport) {}

  list(q: Partial<ListAssetsQueryDTO> = {}): Promise<PaginatedResult<AssetResponseDTO>> {
    return this.t.request<PaginatedResult<AssetResponseDTO>>("GET", this.buildListUrl(q));
  }

  get(publicId: string): Promise<AssetResponseDTO> {
    return this.t.request<AssetResponseDTO>(
      "GET",
      `/v1/assets/${encodeURIComponent(publicId)}`,
    );
  }

  createUploadIntent(
    input: CreateUploadIntentRequestDTO,
  ): Promise<CreateUploadIntentResponseDTO> {
    return this.t.request<CreateUploadIntentResponseDTO>(
      "POST",
      "/v1/assets/upload-intents",
      input,
    );
  }

  refreshUploadUrl(publicId: string): Promise<RefreshUploadUrlResponseDTO> {
    return this.t.request<RefreshUploadUrlResponseDTO>(
      "POST",
      `/v1/assets/upload-intents/${encodeURIComponent(publicId)}/refresh-url`,
      {},
    );
  }

  confirmUpload(
    publicId: string,
    options?: ConfirmUploadRequestDTO,
  ): Promise<AssetResponseDTO> {
    return this.t.request<AssetResponseDTO>(
      "POST",
      `/v1/assets/${encodeURIComponent(publicId)}/confirm`,
      options ?? {},
    );
  }

  async getPreviewUrl(input: {
    publicId: string;
    preset: string;
  }): Promise<PreviewUrlResponseDTO> {
    const url = this.t.buildUrl(
      `/v1/assets/${encodeURIComponent(input.publicId)}/preview-url`,
    );
    url.searchParams.set("preset", input.preset);
    return this.t.request<PreviewUrlResponseDTO>("GET", url.toString());
  }

  getDownloadUrl(input: { publicId: string }): Promise<AssetDownloadUrlResponseDTO> {
    return this.t.request<AssetDownloadUrlResponseDTO>(
      "GET",
      `/v1/assets/${encodeURIComponent(input.publicId)}/download-url`,
    );
  }

  listStateTransitions(publicId: string): Promise<AssetStateTransitionResponseDTO[]> {
    return this.t.request<AssetStateTransitionResponseDTO[]>(
      "GET",
      `/v1/assets/${encodeURIComponent(publicId)}/state-transitions`,
    );
  }

  listAnalyses(publicId: string): Promise<AssetAnalysisResponseDTO[]> {
    return this.t.request<AssetAnalysisResponseDTO[]>(
      "GET",
      `/v1/assets/${encodeURIComponent(publicId)}/analyses`,
    );
  }

  getProcessingJob(publicId: string): Promise<ProcessingJobResponseDTO> {
    return this.t.request<ProcessingJobResponseDTO>(
      "GET",
      `/v1/assets/${encodeURIComponent(publicId)}/processing-job`,
    );
  }

  retryProcessing(publicId: string): Promise<void> {
    return this.t.request<void>(
      "POST",
      `/v1/assets/${encodeURIComponent(publicId)}/retry-processing`,
      {},
    );
  }

  private buildListUrl(q: Partial<ListAssetsQueryDTO>): string {
    const url = this.t.buildUrl("/v1/assets");
    const entries = Object.entries(q) as [string, unknown][];
    for (const [key, value] of entries) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        for (const item of value) {
          url.searchParams.append(key, String(item));
        }
      } else {
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }
}
