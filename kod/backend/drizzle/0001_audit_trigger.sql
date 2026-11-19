-- Audit log is append-only (SPEC §4.6): UPDATE and DELETE are rejected unless the retention job
-- sets `SET LOCAL kezjegy.audit_purge = 'on'` inside its own transaction.
CREATE OR REPLACE FUNCTION kezjegy_audit_guard() RETURNS trigger AS $$
BEGIN
  IF coalesce(current_setting('kezjegy.audit_purge', true), '') = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'audit_log is append-only' USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION kezjegy_audit_guard();
--> statement-breakpoint
CREATE TRIGGER audit_log_no_truncate
  BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION kezjegy_audit_guard();
--> statement-breakpoint
-- One open (not finished) NAV sync run per client at a time.
CREATE UNIQUE INDEX IF NOT EXISTS nav_sync_runs_one_running ON nav_sync_runs (client_id) WHERE status = 'fut';
