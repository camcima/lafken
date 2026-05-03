-- migrate:up

CREATE TABLE IF NOT EXISTS legal_holds (
  id                bigserial PRIMARY KEY,
  case_reference    text NOT NULL,
  description       text NOT NULL,
  scope_summary     text NOT NULL,
  placed_by         text NOT NULL,
  placed_at         timestamptz NOT NULL DEFAULT now(),
  lifted_by         text,
  lifted_at         timestamptz,
  lift_reason       text,
  active            boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS legal_hold_assets (
  legal_hold_id     bigint NOT NULL REFERENCES legal_holds(id) ON DELETE RESTRICT,
  asset_id          bigint NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
  added_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (legal_hold_id, asset_id)
);

CREATE TRIGGER set_legal_holds_updated_at BEFORE UPDATE ON legal_holds FOR EACH ROW EXECUTE FUNCTION update_timestamp_function();

CREATE INDEX IF NOT EXISTS idx_legal_holds_active ON legal_holds(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_legal_hold_assets_asset_id ON legal_hold_assets(asset_id);

-- migrate:down

DROP INDEX IF EXISTS idx_legal_hold_assets_asset_id;
DROP INDEX IF EXISTS idx_legal_holds_active;
DROP TRIGGER IF EXISTS set_legal_holds_updated_at ON legal_holds;
DROP TABLE IF EXISTS legal_hold_assets;
DROP TABLE IF EXISTS legal_holds;
