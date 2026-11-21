-- Javító kör 2026-11-21 (éves ciklus + KATA). ADDITIVE ONLY: two new nullable columns; no existing row or column is
-- changed. up.sh makes the encrypted pg_dump before this runs.

-- annual_closings: the draft document the client approves (a later 'bevallas' document – a quarterly 2658, an önellenőrzés –
-- is never taken for the draft)
ALTER TABLE "annual_closings" ADD COLUMN IF NOT EXISTS "draft_document_id" uuid;--> statement-breakpoint

-- client_tax_profiles: the next year's mode decided in December (the T/928 choice; who filed it, when)
ALTER TABLE "client_tax_profiles" ADD COLUMN IF NOT EXISTS "regime_decision" jsonb;
