-- SPEC §27.11 S9: when and why an admin blocked a client account (additive; the text is staff-only, never shown to the client).
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "disabled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "disabled_reason" text;
