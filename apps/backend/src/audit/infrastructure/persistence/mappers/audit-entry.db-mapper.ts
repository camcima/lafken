import { AuditEntry } from "@/audit/domain/entities/audit-entry.entity";

export class AuditEntryDbMapper {
  static toDomain(row: Record<string, any>): AuditEntry {
    return AuditEntry.fromProps({
      id: BigInt(row["id"] as string),
      entityType: row["entity_type"] as string,
      entityId: row["entity_id"] as string,
      action: row["action"] as string,
      occurredBy: row["occurred_by"] as string,
      beforeState: (row["before_state"] as Record<string, unknown> | null) ?? null,
      afterState: (row["after_state"] as Record<string, unknown> | null) ?? null,
      reason: (row["reason"] as string | null) ?? null,
      occurredAt: new Date(row["occurred_at"] as string),
      createdAt: new Date(row["created_at"] as string),
      updatedAt: new Date(row["updated_at"] as string),
    });
  }
}
