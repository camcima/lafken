-- migrate:up

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_assets_public_id_trgm ON assets USING gin ((public_id::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_assets_external_ref_id_trgm ON assets USING gin (external_ref_id gin_trgm_ops) WHERE external_ref_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assets_uploaded_by_trgm ON assets USING gin (uploaded_by gin_trgm_ops) WHERE uploaded_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assets_content_hash_hex_trgm ON assets USING gin (encode(content_hash, 'hex') gin_trgm_ops) WHERE content_hash IS NOT NULL;

-- migrate:down

DROP INDEX IF EXISTS idx_assets_content_hash_hex_trgm;
DROP INDEX IF EXISTS idx_assets_uploaded_by_trgm;
DROP INDEX IF EXISTS idx_assets_external_ref_id_trgm;
DROP INDEX IF EXISTS idx_assets_public_id_trgm;
