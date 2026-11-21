-- SPEC §32 (éves ciklus és KATA, F0 + F1a – 2026-11-21). ADDITIVE ONLY: new nullable / defaulted columns and one index;
-- no existing row or column is changed here (the one-time data step data.kata_f1 fills them at worker start).
-- up.sh makes the encrypted pg_dump before this runs. Uses no enum value added by 0022.

-- tax_periods: the KATA month rows ('kata', key 'YYYY-MM-KATA'), hiding instead of deleting, free months, backfill
ALTER TABLE "tax_periods" ADD COLUMN IF NOT EXISTS "hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tax_periods" ADD COLUMN IF NOT EXISTS "hidden_reason" text;--> statement-breakpoint
ALTER TABLE "tax_periods" ADD COLUMN IF NOT EXISTS "exempt_reason" text;--> statement-breakpoint
ALTER TABLE "tax_periods" ADD COLUMN IF NOT EXISTS "backfilled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tax_periods_kind_due_idx" ON "tax_periods" USING btree ("kind", "due_date");--> statement-breakpoint

-- tax_payment_items: NAV adónem of the item (288 kata, 103 szja, 406 TB, 258 szocho; HIPA: null)
ALTER TABLE "tax_payment_items" ADD COLUMN IF NOT EXISTS "adonem" text;--> statement-breakpoint

-- client_tax_profiles: which KATA ('regi' = Kata tv., 'uj' = T/928 from 2027 if enacted) and the főfoglalkozás flag
ALTER TABLE "client_tax_profiles" ADD COLUMN IF NOT EXISTS "kata_variant" text CONSTRAINT "client_tax_profiles_kata_variant_chk" CHECK ("kata_variant" in ('regi', 'uj'));--> statement-breakpoint
ALTER TABLE "client_tax_profiles" ADD COLUMN IF NOT EXISTS "kata_fofoglalkozasu" boolean;
