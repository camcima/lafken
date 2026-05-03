import type {
  AuditEntryResponseDTO,
  ListAuditQueryDTO,
  PaginatedResult,
} from "@shared/backend-api";

import { BaseService } from "./BaseService";

export class AuditService extends BaseService {
  private readonly basePath = "/audit";

  async list(
    query: Partial<ListAuditQueryDTO> = {},
  ): Promise<PaginatedResult<AuditEntryResponseDTO>> {
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
