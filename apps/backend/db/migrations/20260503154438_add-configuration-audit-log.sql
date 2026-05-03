-- migrate:up

CREATE TABLE IF NOT EXISTS configuration_audit_log (
  id                bigserial PRIMARY KEY,
  entity_type       text NOT NULL,                     -- 'namespace' | 'namespace_policy' | 'namespace_preset' | 'storage_binding'
  entity_id         text NOT NULL,                     -- text to accommodate slugs / composite keys
  action            text NOT NULL,                     -- 'create' | 'update' | 'archive' | 'delete'
  occurred_by       text NOT NULL,
  before_state      jsonb,
  after_state       jsonb,
  reason            text,
  occurred_at       timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_configuration_audit_log_entity ON configuration_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_configuration_audit_log_occurred_at ON configuration_audit_log(occurred_at);

-- migrate:down

DROP INDEX IF EXISTS idx_configuration_audit_log_occurred_at;
DROP INDEX IF EXISTS idx_configuration_audit_log_entity;
DROP TABLE IF EXISTS configuration_audit_log;
