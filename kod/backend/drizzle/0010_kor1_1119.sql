ALTER TABLE "simplepay_transactions" ADD COLUMN IF NOT EXISTS "payment_url_enc" text;--> statement-breakpoint
ALTER TABLE "gdpr_exports" ADD COLUMN IF NOT EXISTS "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "gdpr_exports" ADD COLUMN IF NOT EXISTS "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "gdpr_exports" ADD COLUMN IF NOT EXISTS "error" text;--> statement-breakpoint
ALTER TABLE "email_codes" ADD COLUMN IF NOT EXISTS "ip_hmac" text;--> statement-breakpoint
ALTER TABLE "email_codes" ADD COLUMN IF NOT EXISTS "foreign_attempts" integer DEFAULT 0 NOT NULL;
