-- migrate:up

CREATE TABLE IF NOT EXISTS storage_bindings (
  id              bigserial PRIMARY KEY,
  name            text NOT NULL UNIQUE,
  adapter_type    text NOT NULL,                     -- 'gcs' | 's3' | 'local'
  config          jsonb NOT NULL,
  encrypted_creds text,                              -- secret reference, never raw
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_storage_bindings_updated_at
  BEFORE UPDATE ON storage_bindings
  FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();

-- migrate:down

DROP TRIGGER IF EXISTS set_storage_bindings_updated_at ON storage_bindings;
DROP TABLE IF EXISTS storage_bindings;
