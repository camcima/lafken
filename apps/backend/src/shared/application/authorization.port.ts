export interface AuthorizationPrincipal {
  id: string;
  roles: string[];
  email?: string;
}

export interface AuthorizationResource {
  type: string;
  id: string;
}

export type AuthorizationAction =
  | "upload_to_namespace"
  | "view_asset"
  | "delete_asset"
  | "set_legal_hold"
  | "lift_legal_hold"
  | "create_namespace"
  | "update_namespace_policy"
  | "archive_namespace"
  | "create_preset"
  | "update_preset"
  | "deactivate_preset"
  | "create_storage_binding"
  | "update_storage_binding"
  | "test_storage_binding"
  | "view_quarantine_queue"
  | "approve_quarantine"
  | "reject_quarantine"
  | "view_audit_log"
  | "export_evidentiary_record"
  | "view_admin_dashboard"
  | "view_system_health";

export abstract class AuthorizationPort {
  abstract can(
    principal: AuthorizationPrincipal,
    action: AuthorizationAction,
    resource: AuthorizationResource,
  ): Promise<boolean>;
}
