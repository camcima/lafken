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
      legalHoldId: query.legalHoldId,
    };
    return this.getApiClient().get<PaginatedResult<AssetResponseDTO>>(
      this.getServiceUrl(this.basePath),
      { params },
    );
  }

  async getById(id: string): Promise<AssetResponseDTO> {
    return this.getApiClient().get<AssetResponseDTO>(this.getServiceUrl(`${this.basePath}/${id}`));
  }

  async listStateTransitions(id: string): Promise<AssetStateTransitionResponseDTO[]> {
    return this.getApiClient().get<AssetStateTransitionResponseDTO[]>(
      this.getServiceUrl(`${this.basePath}/${id}/state-transitions`),
    );
  }

  async listAnalyses(id: string): Promise<AssetAnalysisResponseDTO[]> {
    return this.getApiClient().get<AssetAnalysisResponseDTO[]>(
      this.getServiceUrl(`${this.basePath}/${id}/analyses`),
    );
  }

  async getProcessingJob(id: string): Promise<ProcessingJobResponseDTO> {
    return this.getApiClient().get<ProcessingJobResponseDTO>(
      this.getServiceUrl(`${this.basePath}/${id}/processing-job`),
    );
  }
}
