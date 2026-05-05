-- migrate:up

CREATE TABLE IF NOT EXISTS assets (
  id                          uuid PRIMARY KEY DEFAULT uuidv7(),
  public_id                   uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  namespace_id                uuid NOT NULL REFERENCES namespaces(id) ON DELETE RESTRICT,
  policy_version_id           uuid NOT NULL REFERENCES namespace_policies(id) ON DELETE RESTRICT,
  state                       text NOT NULL,
  storage_binding_id          uuid NOT NULL REFERENCES storage_bindings(id) ON DELETE RESTRICT,
  storage_key                 text NOT NULL,
  content_hash                bytea,
  size_bytes                  bigint,
  mime_type                   text,
  declared_mime_type          text,
  width                       integer,
  height                      integer,
  uploaded_by                 text,
  owning_record_type          text,
  owning_record_id            text,
  custom_metadata             jsonb NOT NULL DEFAULT '{}'::jsonb,
  capture_context             jsonb,
  client_overrides            jsonb NOT NULL DEFAULT '{}'::jsonb,
  effective_max_size_bytes    bigint NOT NULL,
  effective_expires_at        timestamptz,
  effective_url_ttl           integer NOT NULL,
  legal_hold                  boolean NOT NULL DEFAULT false,
  legal_hold_reference        text,
  state_reason                text,
  confirmed_at                timestamptz,
  state_changed_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at                  timestamptz,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS upload_intents (
  id                       uuid PRIMARY KEY DEFAULT uuidv7(),
  public_id                uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  namespace_id             uuid NOT NULL REFERENCES namespaces(id) ON DELETE RESTRICT,
  policy_version_id        uuid NOT NULL REFERENCES namespace_policies(id) ON DELETE RESTRICT,
  storage_binding_id       uuid NOT NULL REFERENCES storage_bindings(id) ON DELETE RESTRICT,
  storage_key              text NOT NULL,
  declared_mime_type       text,
  declared_size_bytes      bigint,
  declared_content_hash    bytea,
  upload_url               text NOT NULL,
  upload_url_expires_at    timestamptz NOT NULL,
  created_by               text,
  consumed_at              timestamptz,
  expired_at               timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS processing_jobs (
  asset_id          uuid PRIMARY KEY REFERENCES assets(id) ON DELETE RESTRICT,
  worker_id         text,
  state             text NOT NULL,
  claimed_at        timestamptz,
  heartbeat_at      timestamptz,
  current_step      text,
  attempt_number    integer NOT NULL DEFAULT 1,
  not_before        timestamptz,
  last_error        text,
  last_error_at     timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS asset_state_transitions (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  asset_id        uuid NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
  from_state      text,
  to_state        text NOT NULL,
  reason          text,
  metadata        jsonb,
  occurred_by     text,
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS asset_analyses (
  id                  uuid PRIMARY KEY DEFAULT uuidv7(),
  asset_id            uuid NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
  analyzer            text NOT NULL,
  analyzer_version    text,
  findings            jsonb NOT NULL,
  decision            text,
  occurred_at         timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_assets_updated_at BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER set_upload_intents_updated_at BEFORE UPDATE ON upload_intents FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER set_processing_jobs_updated_at BEFORE UPDATE ON processing_jobs FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER set_asset_state_transitions_updated_at BEFORE UPDATE ON asset_state_transitions FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();
CREATE TRIGGER set_asset_analyses_updated_at BEFORE UPDATE ON asset_analyses FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();

CREATE INDEX IF NOT EXISTS idx_assets_namespace_state ON assets(namespace_id, state);
CREATE INDEX IF NOT EXISTS idx_assets_state ON assets(state);
CREATE INDEX IF NOT EXISTS idx_assets_owning_record ON assets(owning_record_type, owning_record_id);
CREATE INDEX IF NOT EXISTS idx_assets_uploaded_by ON assets(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets(created_at);
CREATE INDEX IF NOT EXISTS idx_asset_state_transitions_asset_id ON asset_state_transitions(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_analyses_asset_analyzer ON asset_analyses(asset_id, analyzer);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_state_not_before ON processing_jobs(state, not_before) WHERE state = 'released';

-- migrate:down

DROP INDEX IF EXISTS idx_processing_jobs_state_not_before;
DROP INDEX IF EXISTS idx_asset_analyses_asset_analyzer;
DROP INDEX IF EXISTS idx_asset_state_transitions_asset_id;
DROP INDEX IF EXISTS idx_assets_created_at;
DROP INDEX IF EXISTS idx_assets_uploaded_by;
DROP INDEX IF EXISTS idx_assets_owning_record;
DROP INDEX IF EXISTS idx_assets_state;
DROP INDEX IF EXISTS idx_assets_namespace_state;

DROP TRIGGER IF EXISTS set_asset_analyses_updated_at ON asset_analyses;
DROP TRIGGER IF EXISTS set_asset_state_transitions_updated_at ON asset_state_transitions;
DROP TRIGGER IF EXISTS set_processing_jobs_updated_at ON processing_jobs;
DROP TRIGGER IF EXISTS set_upload_intents_updated_at ON upload_intents;
DROP TRIGGER IF EXISTS set_assets_updated_at ON assets;

DROP TABLE IF EXISTS asset_analyses;
DROP TABLE IF EXISTS asset_state_transitions;
DROP TABLE IF EXISTS processing_jobs;
DROP TABLE IF EXISTS upload_intents;
DROP TABLE IF EXISTS assets;
