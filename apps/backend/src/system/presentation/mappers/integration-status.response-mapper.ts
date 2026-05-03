import { IntegrationStatusResponseDTO } from "@shared/backend-api";

import type { IIntegrationStatus } from "@/system/domain/services/integration-status-reader.service.port";

export class IntegrationStatusResponseMapper {
  static fromDomain(status: IIntegrationStatus): IntegrationStatusResponseDTO {
    return {
      port: status.port,
      adapter: status.adapter,
      status: status.status,
      detail: status.detail ?? undefined,
    };
  }
}
