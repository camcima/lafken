import { SystemHealthResponseDTO } from "@shared/backend-api";

import type { ISystemHealthSnapshot } from "@/system/domain/services/system-health-reader.service.port";

import { IntegrationStatusResponseMapper } from "./integration-status.response-mapper";

export class SystemHealthResponseMapper {
  static fromDomain(snapshot: ISystemHealthSnapshot): SystemHealthResponseDTO {
    return {
      overall: snapshot.overall,
      indicators: snapshot.indicators.map((indicator) => ({
        name: indicator.name,
        status: indicator.status,
        detail: indicator.detail ?? undefined,
      })),
      integrations: snapshot.integrations.map((integ) =>
        IntegrationStatusResponseMapper.fromDomain(integ),
      ),
    };
  }
}
