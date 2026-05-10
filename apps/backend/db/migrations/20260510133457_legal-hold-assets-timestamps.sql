-- migrate:up

ALTER TABLE legal_hold_assets
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill: preserve the original record time on existing rows.
UPDATE legal_hold_assets
SET created_at = added_at,
    updated_at = added_at
WHERE created_at = updated_at;

-- The shared trigger function update_timestamp_function() was created by the initial migration.
DROP TRIGGER IF EXISTS set_legal_hold_assets_updated_at ON legal_hold_assets;
CREATE TRIGGER set_legal_hold_assets_updated_at
  BEFORE UPDATE ON legal_hold_assets
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp_function();

-- migrate:down

DROP TRIGGER IF EXISTS set_legal_hold_assets_updated_at ON legal_hold_assets;

ALTER TABLE legal_hold_assets
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS created_at;
