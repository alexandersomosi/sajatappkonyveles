-- SPEC §27.7.1 (2): additive only. New table assist_requests ("Intézzük helyetted"), registration mode + chamber
-- columns, clients.business_status_changed_at, users.totp_locked_until (§27.11 S1), and three CHECK constraints widened
-- (drop + re-add with the old values plus the new ones: every existing row stays valid). The enum values are in 0011.
-- The 0010_kor1_1119 columns (no drizzle snapshot of their own) were removed from this generated file on purpose.
CREATE TABLE IF NOT EXISTS "assist_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'visszahivas_kerve' NOT NULL,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"callback_id" uuid,
	"registration_id" uuid,
	"assigned_user_id" uuid,
	"created_by_role" text NOT NULL,
	"created_by_user_id" uuid,
	"agreed_at" timestamp with time zone,
	"agreed_by" uuid,
	"ujegyke_filed_at" timestamp with time zone,
	"ujegyke_filed_by" uuid,
	"ujegyke_jogcim" text,
	"approval_due_on" date,
	"approval_expires_at" timestamp with time zone,
	"approval_reminders" smallint DEFAULT 0 NOT NULL,
	"last_reminder_at" timestamp with time zone,
	"staff_alerted_at" timestamp with time zone,
	"expired_count" smallint DEFAULT 0 NOT NULL,
	"client_approved_at" timestamp with time zone,
	"mh_live_at" timestamp with time zone,
	"mh_verified_by" uuid,
	"consent_at" timestamp with time zone,
	"consent_hash" text,
	"consent_version" text,
	"consent_snapshot" jsonb,
	"consent_ip" text,
	"consent_user_agent" text,
	"consent_valid" boolean DEFAULT false NOT NULL,
	"consent_document_id" uuid,
	"ev_filed_at" timestamp with time zone,
	"ev_filed_by" uuid,
	"checklist" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"staff_note" text,
	"closed_at" timestamp with time zone,
	"closed_by" uuid,
	"closed_reason" text,
	"close_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assist_requests_kind_chk" CHECK ("assist_requests"."kind" in ('vallalkozas_bejelentes', 'meghatalmazas')),
	CONSTRAINT "assist_requests_status_chk" CHECK ("assist_requests"."status" in ('visszahivas_kerve', 'egyeztetve', 'meghatalmazas_bekuldve', 'meghatalmazas_lejart', 'meghatalmazas_jovahagyva', 'meghatalmazas_el', 'ugyfel_engedelyezte', 'bejelentes_bekuldve', 'kesz', 'visszavonva', 'lezarva')),
	CONSTRAINT "assist_requests_created_by_role_chk" CHECK ("assist_requests"."created_by_role" in ('client', 'csapat', 'admin', 'accountant', 'system')),
	CONSTRAINT "assist_requests_jogcim_chk" CHECK ("assist_requests"."ujegyke_jogcim" in ('9', '60')),
	CONSTRAINT "assist_requests_closed_reason_chk" CHECK ("assist_requests"."closed_reason" in ('nincs_belepese', 'magam_intezem', 'nem_ertuk_el', 'utvaltas', 'duplikalt', 'egyeb'))
);
--> statement-breakpoint
ALTER TABLE "business_registrations" DROP CONSTRAINT IF EXISTS "business_registrations_channel_chk";--> statement-breakpoint
ALTER TABLE "callback_requests" DROP CONSTRAINT IF EXISTS "callback_requests_topic_chk";--> statement-breakpoint
ALTER TABLE "callback_requests" DROP CONSTRAINT IF EXISTS "callback_requests_source_chk";--> statement-breakpoint
ALTER TABLE "business_registrations" ADD COLUMN IF NOT EXISTS "mode" text DEFAULT 'onallo' NOT NULL;--> statement-breakpoint
ALTER TABLE "business_registrations" ADD COLUMN IF NOT EXISTS "chamber_due_on" date;--> statement-breakpoint
ALTER TABLE "business_registrations" ADD COLUMN IF NOT EXISTS "chamber_done_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "business_registrations" ADD COLUMN IF NOT EXISTS "chamber_reminders" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "business_status_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "assist_requests" ADD CONSTRAINT "assist_requests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assist_requests" ADD CONSTRAINT "assist_requests_callback_id_callback_requests_id_fk" FOREIGN KEY ("callback_id") REFERENCES "public"."callback_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assist_requests" ADD CONSTRAINT "assist_requests_registration_id_business_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."business_registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assist_requests" ADD CONSTRAINT "assist_requests_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assist_requests" ADD CONSTRAINT "assist_requests_agreed_by_users_id_fk" FOREIGN KEY ("agreed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assist_requests" ADD CONSTRAINT "assist_requests_ujegyke_filed_by_users_id_fk" FOREIGN KEY ("ujegyke_filed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assist_requests" ADD CONSTRAINT "assist_requests_mh_verified_by_users_id_fk" FOREIGN KEY ("mh_verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assist_requests" ADD CONSTRAINT "assist_requests_consent_document_id_documents_id_fk" FOREIGN KEY ("consent_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assist_requests" ADD CONSTRAINT "assist_requests_ev_filed_by_users_id_fk" FOREIGN KEY ("ev_filed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assist_requests" ADD CONSTRAINT "assist_requests_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assist_requests_open_client_kind_uq" ON "assist_requests" USING btree ("client_id","kind") WHERE status in ('visszahivas_kerve', 'egyeztetve', 'meghatalmazas_bekuldve', 'meghatalmazas_lejart', 'meghatalmazas_jovahagyva', 'meghatalmazas_el', 'ugyfel_engedelyezte', 'bejelentes_bekuldve');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assist_requests_status_status_changed_at_index" ON "assist_requests" USING btree ("status","status_changed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assist_requests_assigned_user_id_status_index" ON "assist_requests" USING btree ("assigned_user_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assist_requests_approval_expires_idx" ON "assist_requests" USING btree ("approval_expires_at") WHERE status = 'meghatalmazas_bekuldve';--> statement-breakpoint
ALTER TABLE "business_registrations" ADD CONSTRAINT "business_registrations_mode_chk" CHECK ("business_registrations"."mode" in ('onallo', 'segitett'));--> statement-breakpoint
ALTER TABLE "business_registrations" ADD CONSTRAINT "business_registrations_channel_chk" CHECK ("business_registrations"."filed_channel" in ('ugyfelkapu_plus', 'dap', 'szemelyesen', 'meghatalmazott'));--> statement-breakpoint
ALTER TABLE "callback_requests" ADD CONSTRAINT "callback_requests_topic_chk" CHECK ("callback_requests"."topic" in ('bekotes', 'vallalkozas_inditas', 'meghatalmazas', 'azonositas', 'elofizetes', 'ado_befizetes', 'szamlak_iratok', 'egyeb', 'vallalkozas_bejelentes_helyettem', 'meghatalmazas_helyettem'));--> statement-breakpoint
ALTER TABLE "callback_requests" ADD CONSTRAINT "callback_requests_source_chk" CHECK ("callback_requests"."source" in ('bekotes', 'adatok', 'vallalkozas_adatlap', 'vallalkozas_utmutato', 'meghatalmazas_utmutato', 'azonositas', 'elofizetes', 'uzenetek', 'fiok', 'gyik', 'konyvelo_kartya', 'zarolt_funkcio', 'csapat', 'regi_idopont', 'helyettunk_vallalkozas', 'helyettunk_meghatalmazas', 'utvaltas'));