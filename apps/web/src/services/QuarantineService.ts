import type { PaginatedResult, QuarantinedAssetResponseDTO } from "@shared/backend-api";

import { BaseService } from "./BaseService";

export interface ListQuarantineQuery {
  page?: number;
  limit?: number;
  kind?: "virus" | "moderation";
  namespaceSlug?: string;
  flaggedFrom?: string;
  flaggedTo?: string;
}

export class QuarantineService extends BaseService {
  private readonly basePath = "/quarantine";

  async list(
    query: ListQuarantineQuery = {},
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
}
