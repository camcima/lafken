import type { LegalHoldResponseDTO, PaginatedResult } from "@shared/backend-api";

import { BaseService } from "./BaseService";

export interface ListLegalHoldsQuery {
  page?: number;
  limit?: number;
}

export class LegalHoldsService extends BaseService {
  private readonly basePath = "/legal-holds";

  async list(query: ListLegalHoldsQuery = {}): Promise<PaginatedResult<LegalHoldResponseDTO>> {
    return this.getApiClient().get<PaginatedResult<LegalHoldResponseDTO>>(
      this.getServiceUrl(this.basePath),
      { params: { page: query.page, limit: query.limit } },
    );
  }

  async getById(id: string): Promise<LegalHoldResponseDTO> {
    return this.getApiClient().get<LegalHoldResponseDTO>(
      this.getServiceUrl(`${this.basePath}/${id}`),
    );
  }
}
