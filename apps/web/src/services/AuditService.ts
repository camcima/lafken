import type { AuditEntryResponseDTO, PaginatedResult } from "@shared/backend-api";

import { BaseService } from "./BaseService";

export interface ListAuditQuery {
  page?: number;
  limit?: number;
  principal?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  occurredFrom?: string;
  occurredTo?: string;
}

export class AuditService extends BaseService {
  private readonly basePath = "/audit";

  async list(query: ListAuditQuery = {}): Promise<PaginatedResult<AuditEntryResponseDTO>> {
    return this.getApiClient().get<PaginatedResult<AuditEntryResponseDTO>>(
      this.getServiceUrl(this.basePath),
      {
        params: {
          page: query.page,
          limit: query.limit,
          principal: query.principal,
          action: query.action,
          entityType: query.entityType,
          entityId: query.entityId,
          occurredFrom: query.occurredFrom,
          occurredTo: query.occurredTo,
        },
      },
    );
  }
}
