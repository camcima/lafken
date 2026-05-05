-- migrate:up

CREATE TABLE IF NOT EXISTS namespaces (
  id                  uuid PRIMARY KEY DEFAULT uuidv7(),
  slug                text NOT NULL UNIQUE,
  display_name        text NOT NULL,
  description         text,
  current_policy_id   uuid NOT NULL,                  -- FK added after namespace_policies exists
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
  retention_mode           text NOT NULL,                -- 'delete' | 'archive' | 'none'
  max_file_size_bytes      bigint NOT NULL,
  allowed_mime_types       text[] NOT NULL,
  exif_handling            text NOT NULL,                -- 'strip' | 'preserve' | 'extract_then_strip'
  virus_scan_required      boolean NOT NULL,
  content_moderation       jsonb,
  required_metadata_schema jsonb,
  immutable                boolean NOT NULL,
  serving_mode             text NOT NULL,                -- 'public' | 'signed' | 'proxied'
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

CREATE TABLE IF NOT EXISTS namespace_presets (
  id                   uuid PRIMARY KEY DEFAULT uuidv7(),
  namespace_id         uuid NOT NULL REFERENCES namespaces(id) ON DELETE RESTRICT,
  name                 text NOT NULL,
  version              integer NOT NULL,
  transformation       jsonb NOT NULL,
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

CREATE TRIGGER set_namespaces_updated_at
  BEFORE UPDATE ON namespaces
  FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();

CREATE TRIGGER set_namespace_policies_updated_at
  BEFORE UPDATE ON namespace_policies
  FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();

CREATE TRIGGER set_namespace_presets_updated_at
  BEFORE UPDATE ON namespace_presets
  FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();

CREATE INDEX IF NOT EXISTS idx_namespace_policies_namespace_id ON namespace_policies(namespace_id);
CREATE INDEX IF NOT EXISTS idx_namespace_presets_namespace_id ON namespace_presets(namespace_id);

-- migrate:down

DROP TRIGGER IF EXISTS set_namespace_presets_updated_at ON namespace_presets;
DROP TRIGGER IF EXISTS set_namespace_policies_updated_at ON namespace_policies;
DROP TRIGGER IF EXISTS set_namespaces_updated_at ON namespaces;

ALTER TABLE namespaces DROP CONSTRAINT IF EXISTS namespaces_current_policy_id_fkey;
DROP TABLE IF EXISTS namespace_presets;
DROP TABLE IF EXISTS namespace_policies;
DROP TABLE IF EXISTS namespaces;
