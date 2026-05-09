// Per-asset state changes still live on `asset_state_transitions`; the audit log
// captures the human-driven events around assets (upload confirmation) plus all
// the config-mutation entities.
export type AuditEntityType =
  | "namespace"
  | "namespace_policy"
  | "namespace_preset"
  | "storage_binding"
  | "legal_hold"
  | "asset"
  | "upload_intent";

export type AuditAction =
  | "create"
  | "update"
  | "archive"
  | "unarchive"
  | "delete"
  | "place"
  | "lift"
  | "expired"
  | "url_refreshed";

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
