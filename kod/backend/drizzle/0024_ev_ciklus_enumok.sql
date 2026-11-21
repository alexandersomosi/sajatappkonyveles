-- SPEC §32.B (éves ciklus, F2/F3 – 2026-11-21): enum values only. ADDITIVE ONLY. Nothing in this migration run uses them
-- (the drizzle migrator applies the pending files in one transaction; a new enum value is usable only after the commit).
ALTER TYPE "public"."payment_item_kind" ADD VALUE IF NOT EXISTS 'szja_kulonbozet';--> statement-breakpoint
ALTER TYPE "public"."payment_item_kind" ADD VALUE IF NOT EXISTS 'onellenorzesi_potlek';--> statement-breakpoint
ALTER TYPE "public"."payment_item_kind" ADD VALUE IF NOT EXISTS 'egyeb_ado';--> statement-breakpoint
ALTER TYPE "public"."document_category" ADD VALUE IF NOT EXISTS 'adoszamla_kivonat';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE IF NOT EXISTS 'correction_status';
