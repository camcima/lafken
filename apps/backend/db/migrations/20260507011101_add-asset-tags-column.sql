-- migrate:up

ALTER TABLE assets ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_assets_tags_gin ON assets USING gin (tags);

-- migrate:down

DROP INDEX IF EXISTS idx_assets_tags_gin;

ALTER TABLE assets DROP COLUMN IF EXISTS tags;
