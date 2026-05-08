// Scoped to config-mutating entities only; asset state lives on `asset_state_transitions`.
export type AuditEntityType =
  | "namespace"
  | "namespace_policy"
  | "namespace_preset"
  | "storage_binding";

export type AuditAction = "create" | "update" | "archive" | "unarchive" | "delete";

export interface IRecordAuditInput {
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  occurredBy: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  reason?: string | null;
  requestIp?: string | null;
}

export abstract class AuditWriteRepositoryPort {
  abstract record(input: IRecordAuditInput): Promise<void>;
}
