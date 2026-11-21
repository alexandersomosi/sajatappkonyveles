-- SPEC §32 (éves ciklus és KATA, F0 + F1a – 2026-11-21): enum values only. ADDITIVE ONLY. Nothing in this migration run
-- uses them (the drizzle migrator applies the pending files in one transaction; a new enum value is usable only after
-- the commit). The KATA payment items were in the shared contract since §28.K.11 but never reached the database enum.
ALTER TYPE "public"."payment_item_kind" ADD VALUE IF NOT EXISTS 'kata_teteles';--> statement-breakpoint
ALTER TYPE "public"."payment_item_kind" ADD VALUE IF NOT EXISTS 'kata_kulonado';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE IF NOT EXISTS 'tax_task';
