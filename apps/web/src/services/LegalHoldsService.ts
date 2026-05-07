import type {
  LegalHoldResponseDTO,
  LiftLegalHoldRequestDTO,
  PaginatedResult,
  PlaceLegalHoldRequestDTO,
} from "@shared/backend-api";

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

  async place(input: PlaceLegalHoldRequestDTO): Promise<LegalHoldResponseDTO> {
    return this.getApiClient().post<PlaceLegalHoldRequestDTO, LegalHoldResponseDTO>(
      this.getServiceUrl(this.basePath),
      input,
    );
  }

  async lift(id: string, input: LiftLegalHoldRequestDTO): Promise<LegalHoldResponseDTO> {
    return this.getApiClient().post<LiftLegalHoldRequestDTO, LegalHoldResponseDTO>(
      this.getServiceUrl(`${this.basePath}/${id}/lift`),
      input,
    );
  }
}
