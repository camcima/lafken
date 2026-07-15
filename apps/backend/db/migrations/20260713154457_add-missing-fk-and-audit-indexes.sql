-- migrate:up

-- FK columns used by ON DELETE RESTRICT checks and frequent joins (F-D7):
-- without these, DELETE /storage-bindings seq-scans assets/upload_intents.
CREATE INDEX IF NOT EXISTS idx_assets_storage_binding_id
  ON assets(storage_binding_id);
CREATE INDEX IF NOT EXISTS idx_assets_policy_version_id
  ON assets(policy_version_id);
CREATE INDEX IF NOT EXISTS idx_upload_intents_namespace_id
  ON upload_intents(namespace_id);
CREATE INDEX IF NOT EXISTS idx_upload_intents_policy_version_id
  ON upload_intents(policy_version_id);
CREATE INDEX IF NOT EXISTS idx_upload_intents_storage_binding_id
  ON upload_intents(storage_binding_id);
CREATE INDEX IF NOT EXISTS idx_namespaces_storage_binding_id
  ON namespaces(storage_binding_id);
CREATE INDEX IF NOT EXISTS idx_namespaces_current_policy_id
  ON namespaces(current_policy_id);

-- configuration_audit_log filter columns (equality filters in the audit list
-- endpoint: occurred_by, action, entity_id).
CREATE INDEX IF NOT EXISTS idx_configuration_audit_log_occurred_by
  ON configuration_audit_log(occurred_by);
CREATE INDEX IF NOT EXISTS idx_configuration_audit_log_action
  ON configuration_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_configuration_audit_log_entity_id
  ON configuration_audit_log(entity_id);

-- pg_trgm GIN indexes for the free-text search (`q`) which ILIKEs over
-- entity_id, occurred_by, and action. The extension is installed by the
-- initial schema migration.
CREATE INDEX IF NOT EXISTS idx_configuration_audit_log_entity_id_trgm
  ON configuration_audit_log USING gin (entity_id gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_configuration_audit_log_occurred_by_trgm
  ON configuration_audit_log USING gin (occurred_by gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_configuration_audit_log_action_trgm
  ON configuration_audit_log USING gin (action gin_trgm_ops);

-- migrate:down

DROP INDEX IF EXISTS idx_configuration_audit_log_action_trgm;
DROP INDEX IF EXISTS idx_configuration_audit_log_occurred_by_trgm;
DROP INDEX IF EXISTS idx_configuration_audit_log_entity_id_trgm;
DROP INDEX IF EXISTS idx_configuration_audit_log_entity_id;
DROP INDEX IF EXISTS idx_configuration_audit_log_action;
DROP INDEX IF EXISTS idx_configuration_audit_log_occurred_by;
DROP INDEX IF EXISTS idx_namespaces_current_policy_id;
DROP INDEX IF EXISTS idx_namespaces_storage_binding_id;
DROP INDEX IF EXISTS idx_upload_intents_storage_binding_id;
DROP INDEX IF EXISTS idx_upload_intents_policy_version_id;
DROP INDEX IF EXISTS idx_upload_intents_namespace_id;
DROP INDEX IF EXISTS idx_assets_policy_version_id;
DROP INDEX IF EXISTS idx_assets_storage_binding_id;
