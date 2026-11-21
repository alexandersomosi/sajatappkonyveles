-- k8 ALAP-B (2026-11-21): enum values only. ADDITIVE ONLY. Nothing in this migration run uses them (the drizzle migrator
-- applies the pending files in one transaction; a new enum value is usable only after the commit).
-- Bank transfer: the díjbekérő is out (transfer_request) and the late reminders (transfer_reminder).
ALTER TYPE "public"."notification_kind" ADD VALUE IF NOT EXISTS 'transfer_request';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE IF NOT EXISTS 'transfer_reminder';
