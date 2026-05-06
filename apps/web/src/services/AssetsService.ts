import type {
  AssetAnalysisResponseDTO,
  AssetResponseDTO,
  AssetStateTransitionResponseDTO,
  ListAssetsQueryDTO,
  PaginatedResult,
  ProcessingJobResponseDTO,
} from "@shared/backend-api";

import { BaseService } from "./BaseService";

export class AssetsService extends BaseService {
  private readonly basePath = "/assets";

  async list(query: Partial<ListAssetsQueryDTO> = {}): Promise<PaginatedResult<AssetResponseDTO>> {
    const params: Record<string, unknown> = {
      page: query.page,
      limit: query.limit,
      namespaceSlug: query.namespaceSlug,
      states: query.states?.join(","),
      uploadedBy: query.uploadedBy,
      externalRefType: query.externalRefType,
      externalRefId: query.externalRefId,
      uploadedFrom: query.uploadedFrom,
      uploadedTo: query.uploadedTo,
    };
    return this.getApiClient().get<PaginatedResult<AssetResponseDTO>>(
      this.getServiceUrl(this.basePath),
      { params },
    );
  }

  async getByPublicId(publicId: string): Promise<AssetResponseDTO> {
    return this.getApiClient().get<AssetResponseDTO>(
      this.getServiceUrl(`${this.basePath}/${publicId}`),
    );
  }

  async listStateTransitions(publicId: string): Promise<AssetStateTransitionResponseDTO[]> {
    return this.getApiClient().get<AssetStateTransitionResponseDTO[]>(
      this.getServiceUrl(`${this.basePath}/${publicId}/state-transitions`),
    );
  }

  async listAnalyses(publicId: string): Promise<AssetAnalysisResponseDTO[]> {
    return this.getApiClient().get<AssetAnalysisResponseDTO[]>(
      this.getServiceUrl(`${this.basePath}/${publicId}/analyses`),
    );
  }

  async getProcessingJob(publicId: string): Promise<ProcessingJobResponseDTO> {
    return this.getApiClient().get<ProcessingJobResponseDTO>(
      this.getServiceUrl(`${this.basePath}/${publicId}/processing-job`),
    );
  }
}
