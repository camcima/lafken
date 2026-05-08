import type {
  AssetResponseDTO,
  ListQuarantineQueryDTO,
  PaginatedResult,
  QuarantinedAssetResponseDTO,
  RejectQuarantinedAssetRequestDTO,
  ReleaseQuarantinedAssetRequestDTO,
} from "@shared/backend-api";

import { BaseService } from "./BaseService";

export class QuarantineService extends BaseService {
  private readonly basePath = "/quarantine";

  async list(
    query: Partial<ListQuarantineQueryDTO> = {},
  ): Promise<PaginatedResult<QuarantinedAssetResponseDTO>> {
    return this.getApiClient().get<PaginatedResult<QuarantinedAssetResponseDTO>>(
      this.getServiceUrl(this.basePath),
      {
        params: {
          page: query.page,
          limit: query.limit,
          kind: query.kind,
          namespaceSlug: query.namespaceSlug,
          flaggedFrom: query.flaggedFrom,
          flaggedTo: query.flaggedTo,
        },
      },
    );
  }

  async release(publicId: string, note?: string): Promise<AssetResponseDTO> {
    return this.getApiClient().post<ReleaseQuarantinedAssetRequestDTO, AssetResponseDTO>(
      this.getServiceUrl(`${this.basePath}/${publicId}/release`),
      { note },
    );
  }

  async reject(publicId: string, note: string): Promise<AssetResponseDTO> {
    return this.getApiClient().post<RejectQuarantinedAssetRequestDTO, AssetResponseDTO>(
      this.getServiceUrl(`${this.basePath}/${publicId}/reject`),
      { note },
    );
  }
}
