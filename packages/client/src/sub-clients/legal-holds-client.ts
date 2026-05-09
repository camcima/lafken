import type {
  LegalHoldResponseDTO,
  LiftLegalHoldRequestDTO,
  PaginatedResult,
  PlaceLegalHoldRequestDTO,
} from "@shared/backend-api";

import type { Transport } from "../transport";

export interface IListLegalHoldsQuery {
  page?: number;
  limit?: number;
}

export class LegalHoldsClient {
  constructor(private readonly t: Transport) {}

  list(q: IListLegalHoldsQuery = {}): Promise<PaginatedResult<LegalHoldResponseDTO>> {
    const url = this.t.buildUrl("/v1/legal-holds");
    if (q.page !== undefined) url.searchParams.set("page", String(q.page));
    if (q.limit !== undefined) url.searchParams.set("limit", String(q.limit));
    return this.t.request<PaginatedResult<LegalHoldResponseDTO>>("GET", url.toString());
  }

  get(id: string): Promise<LegalHoldResponseDTO> {
    return this.t.request<LegalHoldResponseDTO>(
      "GET",
      `/v1/legal-holds/${encodeURIComponent(id)}`,
    );
  }

  place(input: PlaceLegalHoldRequestDTO): Promise<LegalHoldResponseDTO> {
    return this.t.request<LegalHoldResponseDTO>("POST", "/v1/legal-holds", input);
  }

  lift(id: string, body: LiftLegalHoldRequestDTO): Promise<LegalHoldResponseDTO> {
    return this.t.request<LegalHoldResponseDTO>(
      "POST",
      `/v1/legal-holds/${encodeURIComponent(id)}/lift`,
      body,
    );
  }
}
