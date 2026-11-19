CREATE TABLE "business_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"status" text DEFAULT 'kitoltes' NOT NULL,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"submitted_at" timestamp with time zone,
	"guide_opened_at" timestamp with time zone,
	"guide_progress" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"filed_on" date,
	"filed_channel" text,
	"filed_document_id" uuid,
	"filed_at" timestamp with time zone,
	"check_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"checked_by" uuid,
	"checked_at" timestamp with time zone,
	"fix_note" text,
	"fix_requested_at" timestamp with time zone,
	"adoszam" text,
	"ev_nyilvantartasi_szam" text,
	"registered_on" date,
	"adoszam_set_by" uuid,
	"done_at" timestamp with time zone,
	"withdrawn_at" timestamp with time zone,
	"withdraw_reason" text,
	"withdraw_note" text,
	"assigned_user_id" uuid,
	"staff_note" text,
	"reminder_count" smallint DEFAULT 0 NOT NULL,
	"last_reminder_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_registrations_status_chk" CHECK ("business_registrations"."status" in ('kitoltes', 'utmutato', 'beadva', 'javitas', 'ellenorizve', 'kesz', 'elallt')),
	CONSTRAINT "business_registrations_channel_chk" CHECK ("business_registrations"."filed_channel" in ('ugyfelkapu_plus', 'dap', 'szemelyesen')),
	CONSTRAINT "business_registrations_withdraw_reason_chk" CHECK ("business_registrations"."withdraw_reason" in ('mar_van_vallalkozasa', 'kesobb_inditom', 'meggondolta', 'egyeb'))
);
--> statement-breakpoint
CREATE TABLE "callback_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"callback_id" uuid NOT NULL,
	"by_user_id" uuid NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"outcome" text NOT NULL,
	"note" text,
	CONSTRAINT "callback_attempts_outcome_chk" CHECK ("callback_attempts"."outcome" in ('beszeltunk', 'nem_vette_fel', 'foglalt', 'hibas_szam', 'kesobb_kerte'))
);
--> statement-breakpoint
CREATE TABLE "callback_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"created_by_user_id" uuid,
	"created_by_role" text NOT NULL,
	"status" text DEFAULT 'uj' NOT NULL,
	"topic" text NOT NULL,
	"source" text NOT NULL,
	"call_window" text DEFAULT 'barmikor' NOT NULL,
	"note" text,
	"phone_enc" text,
	"phone_masked" text,
	"needs_new_phone" boolean DEFAULT false NOT NULL,
	"target_at" timestamp with time zone NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"assigned_user_id" uuid,
	"assigned_at" timestamp with time zone,
	"calling_now_until" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"last_outcome" text,
	"next_attempt_after" timestamp with time zone,
	"internal_note" text,
	"summary_for_client" text,
	"summary_message_id" uuid,
	"closed_at" timestamp with time zone,
	"closed_by" uuid,
	"closed_reason" text,
	"overdue_notified_at" timestamp with time zone,
	"legacy_appointment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "callback_requests_legacyAppointmentId_unique" UNIQUE("legacy_appointment_id"),
	CONSTRAINT "callback_requests_status_chk" CHECK ("callback_requests"."status" in ('uj', 'folyamatban', 'teljesitve', 'sikertelen', 'visszavonva', 'lezarva')),
	CONSTRAINT "callback_requests_topic_chk" CHECK ("callback_requests"."topic" in ('bekotes', 'vallalkozas_inditas', 'meghatalmazas', 'azonositas', 'elofizetes', 'ado_befizetes', 'szamlak_iratok', 'egyeb')),
	CONSTRAINT "callback_requests_source_chk" CHECK ("callback_requests"."source" in ('bekotes', 'adatok', 'vallalkozas_adatlap', 'vallalkozas_utmutato', 'meghatalmazas_utmutato', 'azonositas', 'elofizetes', 'uzenetek', 'fiok', 'gyik', 'konyvelo_kartya', 'zarolt_funkcio', 'csapat', 'regi_idopont')),
	CONSTRAINT "callback_requests_window_chk" CHECK ("callback_requests"."call_window" in ('barmikor', 'delelott', 'delutan')),
	CONSTRAINT "callback_requests_created_by_role_chk" CHECK ("callback_requests"."created_by_role" in ('client', 'csapat', 'admin', 'accountant', 'system')),
	CONSTRAINT "callback_requests_last_outcome_chk" CHECK ("callback_requests"."last_outcome" in ('beszeltunk', 'nem_vette_fel', 'foglalt', 'hibas_szam', 'kesobb_kerte')),
	CONSTRAINT "callback_requests_closed_reason_chk" CHECK ("callback_requests"."closed_reason" in ('megoldva_uzenetben', 'duplikalt', 'ugyfel_kerte', 'egyeb')),
	CONSTRAINT "callback_requests_note_len_chk" CHECK (char_length("callback_requests"."note") <= 500)
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"first_name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "business_status" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "read_by_team_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "business_registrations" ADD CONSTRAINT "business_registrations_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_registrations" ADD CONSTRAINT "business_registrations_filed_document_id_documents_id_fk" FOREIGN KEY ("filed_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_registrations" ADD CONSTRAINT "business_registrations_checked_by_users_id_fk" FOREIGN KEY ("checked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_registrations" ADD CONSTRAINT "business_registrations_adoszam_set_by_users_id_fk" FOREIGN KEY ("adoszam_set_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_registrations" ADD CONSTRAINT "business_registrations_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "callback_attempts" ADD CONSTRAINT "callback_attempts_callback_id_callback_requests_id_fk" FOREIGN KEY ("callback_id") REFERENCES "public"."callback_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "callback_attempts" ADD CONSTRAINT "callback_attempts_by_user_id_users_id_fk" FOREIGN KEY ("by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "callback_requests" ADD CONSTRAINT "callback_requests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "callback_requests" ADD CONSTRAINT "callback_requests_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "callback_requests" ADD CONSTRAINT "callback_requests_legacy_appointment_id_appointments_id_fk" FOREIGN KEY ("legacy_appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "business_registrations_open_client_uq" ON "business_registrations" USING btree ("client_id") WHERE status in ('kitoltes', 'utmutato', 'beadva', 'javitas', 'ellenorizve');--> statement-breakpoint
CREATE INDEX "business_registrations_status_status_changed_at_index" ON "business_registrations" USING btree ("status","status_changed_at");--> statement-breakpoint
CREATE INDEX "callback_attempts_callback_id_at_index" ON "callback_attempts" USING btree ("callback_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "callback_requests_open_client_uq" ON "callback_requests" USING btree ("client_id") WHERE status in ('uj', 'folyamatban');--> statement-breakpoint
CREATE INDEX "callback_requests_status_due_at_index" ON "callback_requests" USING btree ("status","due_at");--> statement-breakpoint
CREATE INDEX "callback_requests_assigned_user_id_status_index" ON "callback_requests" USING btree ("assigned_user_id","status");--> statement-breakpoint
CREATE INDEX "callback_requests_client_id_created_at_index" ON "callback_requests" USING btree ("client_id","created_at");--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_business_status_chk" CHECK ("clients"."business_status" in ('van', 'inditas'));