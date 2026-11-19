ALTER TABLE "client_tax_profiles" ADD COLUMN "allowances" jsonb;--> statement-breakpoint
ALTER TABLE "demo_outbox" ADD COLUMN "template" text;--> statement-breakpoint
ALTER TABLE "push_tokens" ADD COLUMN "installation_hash" text;--> statement-breakpoint
ALTER TABLE "simplepay_transactions" ADD COLUMN "after_final_status" text;--> statement-breakpoint
ALTER TABLE "simplepay_transactions" ADD COLUMN "after_final_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_failed_login_at" timestamp with time zone;