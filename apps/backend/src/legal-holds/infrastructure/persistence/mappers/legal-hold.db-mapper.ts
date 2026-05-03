import { LegalHold } from "@/legal-holds/domain/entities/legal-hold.entity";

export class LegalHoldDbMapper {
  static toDomain(row: Record<string, any>): LegalHold {
    return LegalHold.fromProps({
      id: BigInt(row["id"]),
      caseReference: row["case_reference"] as string,
      description: row["description"] as string,
      scopeSummary: row["scope_summary"] as string,
      placedBy: row["placed_by"] as string,
      placedAt: new Date(row["placed_at"] as string),
      liftedBy: (row["lifted_by"] as string | null) ?? null,
      liftedAt: row["lifted_at"] ? new Date(row["lifted_at"] as string) : null,
      liftReason: (row["lift_reason"] as string | null) ?? null,
      active: row["active"] as boolean,
      createdAt: new Date(row["created_at"] as string),
      updatedAt: new Date(row["updated_at"] as string),
    });
  }
}
