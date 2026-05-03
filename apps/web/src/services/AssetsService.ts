import type {
  AssetAnalysisResponseDTO,
  AssetResponseDTO,
  AssetState,
  AssetStateTransitionResponseDTO,
  PaginatedResult,
  ProcessingJobResponseDTO,
} from "@shared/backend-api";

import { BaseService } from "./BaseService";

export interface ListAssetsQuery {
  page?: number;
  limit?: number;
  namespaceSlug?: string;
  states?: AssetState[];
  uploadedBy?: string;
  owningRecordType?: string;
  owningRecordId?: string;
  uploadedFrom?: string;
  uploadedTo?: string;
}

export class AssetsService extends BaseService {
  private readonly basePath = "/assets";

  async list(query: ListAssetsQuery = {}): Promise<PaginatedResult<AssetResponseDTO>> {
    return this.getApiClient().get<PaginatedResult<AssetResponseDTO>>(
      this.getServiceUrl(this.basePath),
      {
        params: {
          page: query.page,
          limit: query.limit,
          namespaceSlug: query.namespaceSlug,
          states: query.states,
          uploadedBy: query.uploadedBy,
          owningRecordType: query.owningRecordType,
          owningRecordId: query.owningRecordId,
          uploadedFrom: query.uploadedFrom,
          uploadedTo: query.uploadedTo,
        },
      },
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
