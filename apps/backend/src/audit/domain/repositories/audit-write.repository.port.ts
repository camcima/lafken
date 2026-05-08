/**
 * Configuration audit log entry types. The set is intentionally narrow: only
 * the subjects that the `configuration_audit_log` table is scoped to per its
 * migration (namespaces, namespace policies, namespace presets, storage
 * bindings). Asset-level state changes are recorded separately on
 * `asset_state_transitions` and surfaced on per-asset detail pages.
 */
export type AuditEntityType =
  | "namespace"
  | "namespace_policy"
  | "namespace_preset"
  | "storage_binding";

/**
 * Action verbs persisted on the audit row. Kept stable so the FE can map them
 * to icons and copy without a separate translation table.
 */
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
