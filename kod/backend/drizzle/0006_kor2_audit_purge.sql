-- Kör 2: the API and worker run as a least-privilege role (kezjegy_app, deploy/db-roles.sh) without UPDATE,
-- DELETE or TRUNCATE on audit_log. The 5-year retention purge goes through this SECURITY DEFINER function
-- (owned by the migration role), which never deletes anything newer than 5 years.
CREATE OR REPLACE FUNCTION kezjegy_audit_purge(cutoff timestamptz) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n integer;
BEGIN
  -- Never newer than 5 years: a caller cannot use this to delete recent entries.
  cutoff := least(cutoff, now() - interval '5 years');
  PERFORM set_config('kezjegy.audit_purge', 'on', true);
  DELETE FROM audit_log WHERE at < cutoff;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM set_config('kezjegy.audit_purge', 'off', true);
  RETURN n;
END;
$$;
