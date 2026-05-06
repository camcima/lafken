-- migrate:up

ALTER TABLE assets RENAME COLUMN owning_record_type TO external_ref_type;
ALTER TABLE assets RENAME COLUMN owning_record_id TO external_ref_id;
ALTER INDEX IF EXISTS idx_assets_owning_record RENAME TO idx_assets_external_ref;

-- migrate:down

ALTER INDEX IF EXISTS idx_assets_external_ref RENAME TO idx_assets_owning_record;
ALTER TABLE assets RENAME COLUMN external_ref_id TO owning_record_id;
ALTER TABLE assets RENAME COLUMN external_ref_type TO owning_record_type;
