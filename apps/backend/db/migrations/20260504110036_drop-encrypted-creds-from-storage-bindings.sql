-- migrate:up
ALTER TABLE storage_bindings DROP COLUMN IF EXISTS encrypted_creds;

-- migrate:down
ALTER TABLE storage_bindings ADD COLUMN IF NOT EXISTS encrypted_creds text;

