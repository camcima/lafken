-- migrate:up

ALTER TABLE configuration_audit_log
  ADD COLUMN IF NOT EXISTS request_ip inet;

-- migrate:down

ALTER TABLE configuration_audit_log
  DROP COLUMN IF EXISTS request_ip;
