-- migrate:up

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION update_timestamp_function() RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS storage_bindings (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  name          text NOT NULL UNIQUE,
  adapter_type  text NOT NULL,
  config        jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS namespaces (
  id                  uuid PRIMARY KEY DEFAULT uuidv7(),
  slug                text NOT NULL UNIQUE,
  display_name        text NOT NULL,
  description         text,
  current_policy_id   uuid NOT NULL,
  storage_binding_id  uuid NOT NULL REFERENCES storage_bindings(id) ON DELETE RESTRICT,
  archived_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS namespace_policies (
  id                       uuid PRIMARY KEY DEFAULT uuidv7(),
  namespace_id             uuid NOT NULL REFERENCES namespaces(id) ON DELETE RESTRICT,
  version                  integer NOT NULL,
  retention_days           integer,
  retention_mode           text NOT NULL,
  max_file_size_bytes      bigint NOT NULL,
  allowed_mime_types       text[] NOT NULL,
  exif_handling            text NOT NULL,
  virus_scan_required      boolean NOT NULL,
  content_moderation       jsonb,
  required_metadata_schema jsonb,
  immutable                boolean NOT NULL,
  serving_mode             text NOT NULL,
  signed_url_ttl_seconds   integer,
  signed_url_bucket_size   integer,
  retry_config             jsonb,
  created_by               text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (namespace_id, version)
);

ALTER TABLE namespaces
  ADD CONSTRAINT namespaces_current_policy_id_fkey
  FOREIGN KEY (current_policy_id) REFERENCES namespace_policies(id) DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX IF NOT EXISTS idx_namespace_policies_namespace_id
  ON namespace_policies(namespace_id);

CREATE TABLE IF NOT EXISTS namespace_presets (
  id                   uuid PRIMARY KEY DEFAULT uuidv7(),
  namespace_id         uuid NOT NULL REFERENCES namespaces(id) ON DELETE RESTRICT,
  name                 text NOT NULL,
  version              integer NOT NULL,
  params               jsonb NOT NULL,
  cdn_max_age          integer,
  signed_url_ttl       integer,
  pre_generate         boolean NOT NULL DEFAULT false,
  required_permission  text,
  description          text,
  active               boolean NOT NULL DEFAULT true,
  created_by           text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (namespace_id, name, version)
);

CREATE INDEX IF NOT EXISTS idx_namespace_presets_namespace_id_name
  ON namespace_presets(namespace_id, name);

CREATE TABLE IF NOT EXISTS assets (
  id                       uuid PRIMARY KEY DEFAULT uuidv7(),
  public_id                uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  namespace_id             uuid NOT NULL REFERENCES namespaces(id) ON DELETE RESTRICT,
  policy_version_id        uuid NOT NULL REFERENCES namespace_policies(id) ON DELETE RESTRICT,
  state                    text NOT NULL,
  storage_binding_id       uuid NOT NULL REFERENCES storage_bindings(id) ON DELETE RESTRICT,
  storage_key              text NOT NULL,
  content_hash             bytea,
  size_bytes               bigint,
  mime_type                text,
  declared_mime_type       text,
  width                    integer,
  height                   integer,
  uploaded_by              text,
  external_ref_type        text,
  external_ref_id          text,
  custom_metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  capture_context          jsonb,
  client_overrides         jsonb NOT NULL DEFAULT '{}'::jsonb,
  effective_max_size_bytes bigint NOT NULL,
  effective_expires_at     timestamptz,
  effective_url_ttl        integer NOT NULL,
  legal_hold               boolean NOT NULL DEFAULT false,
  legal_hold_reference     text,
  state_reason             text,
  confirmed_at             timestamptz,
  state_changed_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at               timestamptz,
  phash                    bytea,
  tags                     text[] NOT NULL DEFAULT '{}'::text[],
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assets_namespace_state ON assets(namespace_id, state);
CREATE INDEX IF NOT EXISTS idx_assets_state ON assets(state);
CREATE INDEX IF NOT EXISTS idx_assets_external_ref ON assets(external_ref_type, external_ref_id);
CREATE INDEX IF NOT EXISTS idx_assets_uploaded_by ON assets(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets(created_at);
CREATE INDEX IF NOT EXISTS idx_assets_tags_gin ON assets USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_assets_public_id_trgm
  ON assets USING gin ((public_id::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_assets_external_ref_id_trgm
  ON assets USING gin (external_ref_id gin_trgm_ops) WHERE external_ref_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assets_uploaded_by_trgm
  ON assets USING gin (uploaded_by gin_trgm_ops) WHERE uploaded_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assets_content_hash_hex_trgm
  ON assets USING gin (encode(content_hash, 'hex') gin_trgm_ops) WHERE content_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS asset_analyses (
  id                uuid PRIMARY KEY DEFAULT uuidv7(),
  asset_id          uuid NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
  analyzer          text NOT NULL,
  analyzer_version  text,
  findings          jsonb NOT NULL,
  decision          text,
  occurred_at       timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_analyses_asset_analyzer ON asset_analyses(asset_id, analyzer);

CREATE TABLE IF NOT EXISTS asset_state_transitions (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  asset_id     uuid NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
  from_state   text,
  to_state     text NOT NULL,
  reason       text,
  metadata     jsonb,
  occurred_by  text,
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_state_transitions_asset_id ON asset_state_transitions(asset_id);

CREATE TABLE IF NOT EXISTS upload_intents (
  id                     uuid PRIMARY KEY DEFAULT uuidv7(),
  public_id              uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  namespace_id           uuid NOT NULL REFERENCES namespaces(id) ON DELETE RESTRICT,
  policy_version_id      uuid NOT NULL REFERENCES namespace_policies(id) ON DELETE RESTRICT,
  storage_binding_id     uuid NOT NULL REFERENCES storage_bindings(id) ON DELETE RESTRICT,
  storage_key            text NOT NULL,
  declared_mime_type     text,
  declared_size_bytes    bigint,
  declared_content_hash  bytea,
  upload_url             text NOT NULL,
  upload_url_expires_at  timestamptz NOT NULL,
  created_by             text,
  consumed_at            timestamptz,
  expired_at             timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS legal_holds (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  case_reference  text NOT NULL,
  description     text NOT NULL,
  scope_summary   text NOT NULL,
  placed_by       text NOT NULL,
  placed_at       timestamptz NOT NULL DEFAULT now(),
  lifted_by       text,
  lifted_at       timestamptz,
  lift_reason     text,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_holds_active ON legal_holds(active) WHERE active = true;

CREATE TABLE IF NOT EXISTS legal_hold_assets (
  legal_hold_id  uuid NOT NULL REFERENCES legal_holds(id) ON DELETE RESTRICT,
  asset_id       uuid NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
  added_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (legal_hold_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_legal_hold_assets_asset_id ON legal_hold_assets(asset_id);

CREATE TABLE IF NOT EXISTS processing_jobs (
  asset_id        uuid PRIMARY KEY REFERENCES assets(id) ON DELETE RESTRICT,
  worker_id       text,
  state           text NOT NULL,
  claimed_at      timestamptz,
  heartbeat_at    timestamptz,
  current_step    text,
  attempt_number  integer NOT NULL DEFAULT 1,
  not_before      timestamptz,
  last_error      text,
  last_error_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processing_jobs_state_not_before
  ON processing_jobs(state, not_before) WHERE state = 'released';

CREATE TABLE IF NOT EXISTS configuration_audit_log (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  entity_type   text NOT NULL,
  entity_id     text NOT NULL,
  action        text NOT NULL,
  occurred_by   text NOT NULL,
  before_state  jsonb,
  after_state   jsonb,
  reason        text,
  request_ip    inet,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_configuration_audit_log_entity
  ON configuration_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_configuration_audit_log_occurred_at
  ON configuration_audit_log(occurred_at);

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'storage_bindings',
    'namespaces',
    'namespace_policies',
    'namespace_presets',
    'assets',
    'asset_analyses',
    'asset_state_transitions',
    'upload_intents',
    'legal_holds',
    'processing_jobs',
    'configuration_audit_log'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_%1$s_updated_at ON %1$s;
       CREATE TRIGGER set_%1$s_updated_at BEFORE UPDATE ON %1$s
         FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();',
      tbl
    );
  END LOOP;
END;
$$;

-- migrate:down

DROP TABLE IF EXISTS configuration_audit_log;
DROP TABLE IF EXISTS processing_jobs;
DROP TABLE IF EXISTS legal_hold_assets;
DROP TABLE IF EXISTS legal_holds;
DROP TABLE IF EXISTS upload_intents;
DROP TABLE IF EXISTS asset_state_transitions;
DROP TABLE IF EXISTS asset_analyses;
DROP TABLE IF EXISTS assets;
DROP TABLE IF EXISTS namespace_presets;
ALTER TABLE IF EXISTS namespaces DROP CONSTRAINT IF EXISTS namespaces_current_policy_id_fkey;
DROP TABLE IF EXISTS namespace_policies;
DROP TABLE IF EXISTS namespaces;
DROP TABLE IF EXISTS storage_bindings;
DROP FUNCTION IF EXISTS update_timestamp_function();
