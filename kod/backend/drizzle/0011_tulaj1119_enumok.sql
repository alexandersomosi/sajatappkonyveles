-- SPEC §27.7.1 (1): enum values only (the 10 notification kinds of §27.8, in NOTIFICATION_KINDS order). Nothing in this
-- run may USE these values in the same transaction (Postgres rule; §26.9.1).
ALTER TYPE "public"."notification_kind" ADD VALUE IF NOT EXISTS 'assist_started';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE IF NOT EXISTS 'assist_mh_filed';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE IF NOT EXISTS 'assist_mh_reminder';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE IF NOT EXISTS 'assist_mh_expired';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE IF NOT EXISTS 'assist_consent_needed';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE IF NOT EXISTS 'assist_ev_filed';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE IF NOT EXISTS 'kamara_reminder';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE IF NOT EXISTS 'assist_task';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE IF NOT EXISTS 'assist_approval_overdue';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE IF NOT EXISTS 'client_path_changed';
