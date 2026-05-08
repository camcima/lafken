import type { AuditEntryResponseDTO } from "@shared/backend-api";

import type { AuditEntry } from "@/audit/domain/entities/audit-entry.entity";

export class AuditEntryResponseMapper {
  static fromDomain(entry: AuditEntry): AuditEntryResponseDTO {
    return {
      id: entry.props.id.toString(),
      entityType: entry.props.entityType,
      entityId: entry.props.entityId,
      action: entry.props.action,
      occurredBy: entry.props.occurredBy,
      beforeState: entry.props.beforeState ?? undefined,
      afterState: entry.props.afterState ?? undefined,
      reason: entry.props.reason ?? undefined,
      requestIp: entry.props.requestIp ?? undefined,
      occurredAt: entry.props.occurredAt.toISOString(),
    };
  }
}
