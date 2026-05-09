import type {
  AuditEntryResponseDTO,
  ListAuditQueryDTO,
  PaginatedResult,
} from "@shared/backend-api";

import type { Transport } from "../transport";

export class AuditClient {
  constructor(private readonly t: Transport) {}

  list(q: Partial<ListAuditQueryDTO> = {}): Promise<PaginatedResult<AuditEntryResponseDTO>> {
    const url = this.t.buildUrl("/v1/audit");
    const entries = Object.entries(q) as [string, unknown][];
    for (const [key, value] of entries) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
    return this.t.request<PaginatedResult<AuditEntryResponseDTO>>("GET", url.toString());
  }
}
