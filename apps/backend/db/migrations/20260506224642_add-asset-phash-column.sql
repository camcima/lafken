-- migrate:up

ALTER TABLE assets ADD COLUMN IF NOT EXISTS phash bytea;

-- migrate:down

ALTER TABLE assets DROP COLUMN IF EXISTS phash;
