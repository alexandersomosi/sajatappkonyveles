-- SPEC §28.K.16: fees, monthly check-in, annual closing, lock, pause, EFO, KATA columns, mailbox (additive; pg_dump first).
CREATE TABLE IF NOT EXISTS "fee_settings" (
  "kind" text PRIMARY KEY NOT NULL,
  "amount_huf" integer NOT NULL,
  "unit" text NOT NULL,
  "confirmed_at" timestamp with time zone,
  "confirmed_by" uuid REFERENCES "users"("id"),
  "effective_from" date,
  "updated_by" uuid,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "fee_settings_kind_chk" CHECK ("kind" in ('havidij', 'havidij_kata', 'eves_zaras', 'valtozas_egyszeru', 'valtozas_jogallas', 'szuneteltetesi_dij')),
  CONSTRAINT "fee_settings_amount_chk" CHECK ("amount_huf" >= 0),
  CONSTRAINT "fee_settings_unit_chk" CHECK ("unit" in ('ho', 'ev', 'alkalom'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fee_setting_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "kind" text NOT NULL,
  "amount_huf" integer NOT NULL,
  "confirmed" boolean DEFAULT false NOT NULL,
  "changed_by" uuid,
  "changed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "note" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_setting_history_kind_changed_at_index" ON "fee_setting_history" ("kind", "changed_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fee_charges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL REFERENCES "clients"("id"),
  "kind" text NOT NULL,
  "amount_huf" integer NOT NULL,
  "purpose" jsonb NOT NULL,
  "status" text DEFAULT 'nyitott' NOT NULL,
  "due_on" date,
  "simplepay_transaction_id" uuid,
  "fee_invoice_id" uuid,
  "demo" boolean DEFAULT false NOT NULL,
  "waived_by" uuid,
  "waived_at" timestamp with time zone,
  "waived_reason" text,
  "refund_note" text,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "paid_at" timestamp with time zone,
  CONSTRAINT "fee_charges_kind_chk" CHECK ("kind" in ('havidij', 'havidij_kata', 'eves_zaras', 'valtozas_egyszeru', 'valtozas_jogallas', 'szuneteltetesi_dij')),
  CONSTRAINT "fee_charges_status_chk" CHECK ("status" in ('nyitott', 'fizetve', 'visszavonva', 'visszaterites_kell', 'visszaterites_megtortent', 'elengedve'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_charges_client_id_status_index" ON "fee_charges" ("client_id", "status");
--> statement-breakpoint
ALTER TABLE "assist_requests" ADD COLUMN IF NOT EXISTS "fee_charge_id" uuid;
--> statement-breakpoint
ALTER TABLE "assist_requests" DROP CONSTRAINT IF EXISTS "assist_requests_status_chk";
--> statement-breakpoint
ALTER TABLE "assist_requests" ADD CONSTRAINT "assist_requests_status_chk" CHECK ("status" in ('visszahivas_kerve', 'dijra_var', 'egyeztetve', 'meghatalmazas_bekuldve', 'meghatalmazas_lejart', 'meghatalmazas_jovahagyva', 'meghatalmazas_el', 'ugyfel_engedelyezte', 'bejelentes_bekuldve', 'kesz', 'visszavonva', 'lezarva'));
--> statement-breakpoint
DROP INDEX IF EXISTS "assist_requests_open_client_kind_uq";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "assist_requests_open_client_kind_uq" ON "assist_requests" ("client_id", "kind") WHERE status in ('dijra_var', 'visszahivas_kerve', 'egyeztetve', 'meghatalmazas_bekuldve', 'meghatalmazas_lejart', 'meghatalmazas_jovahagyva', 'meghatalmazas_el', 'ugyfel_engedelyezte', 'bejelentes_bekuldve');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "monthly_checkins" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL REFERENCES "clients"("id"),
  "period" text NOT NULL,
  "status" text DEFAULT 'nyitott' NOT NULL,
  "answers" jsonb,
  "opened_at" timestamp with time zone DEFAULT now() NOT NULL,
  "answered_at" timestamp with time zone,
  "reminded" jsonb DEFAULT '{}'::jsonb NOT NULL,
  CONSTRAINT "monthly_checkins_status_chk" CHECK ("status" in ('nyitott', 'nem_valtozott', 'valtozott', 'lejart'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "monthly_checkins_client_id_period_index" ON "monthly_checkins" ("client_id", "period");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "checkin_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "checkin_id" uuid NOT NULL REFERENCES "monthly_checkins"("id"),
  "client_id" uuid NOT NULL REFERENCES "clients"("id"),
  "item" text NOT NULL,
  "status" text DEFAULT 'uj' NOT NULL,
  "details" jsonb NOT NULL,
  "assist_id" uuid,
  "fee_charge_id" uuid,
  "staff_note" text,
  "client_text" text,
  "decided_by" uuid,
  "decided_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "checkin_items_item_chk" CHECK ("item" in ('munkaviszony', 'nyugdij', 'koltozes', 'tevekenyseg', 'csalad', 'alkalmazott', 'szuneteltetes', 'folytatas', 'kata_ceges', 'egyeb')),
  CONSTRAINT "checkin_items_status_chk" CHECK ("status" in ('uj', 'dijra_var', 'csapatnal', 'ugyfel_intezi', 'kesz', 'nem_kell'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "checkin_items_client_id_status_index" ON "checkin_items" ("client_id", "status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "annual_closings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL REFERENCES "clients"("id"),
  "tax_year" integer NOT NULL,
  "regime" text DEFAULT 'atalany' NOT NULL,
  "status" text DEFAULT 'nem_indult' NOT NULL,
  "answers" jsonb,
  "refund_account_enc" text,
  "fee_charge_id" uuid,
  "questionnaire_due" date NOT NULL,
  "submitted_at" timestamp with time zone,
  "approved_at" timestamp with time zone,
  "approval_hash" text,
  "filed_szja_at" timestamp with time zone,
  "filed_hipa_at" timestamp with time zone,
  "checklist" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "annual_closings_status_chk" CHECK ("status" in ('nem_indult', 'kerdoiv', 'dijra_var', 'konyvelonel', 'jovahagyasra_var', 'beadva', 'kesz')),
  CONSTRAINT "annual_closings_regime_chk" CHECK ("regime" in ('atalany', 'kata'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "annual_closings_client_id_tax_year_index" ON "annual_closings" ("client_id", "tax_year");
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "service_lock" jsonb;
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "adoszam_pending" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "tax_regime_answer" text;
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "mailbox_code" text;
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "mailbox_senders" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "clients_mailbox_code_unique" ON "clients" ("mailbox_code");
--> statement-breakpoint
ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "clients_tax_regime_answer_chk";
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_tax_regime_answer_chk" CHECK ("tax_regime_answer" in ('atalany', 'kata', 'nem_tudom'));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_employer_status" (
  "client_id" uuid PRIMARY KEY NOT NULL REFERENCES "clients"("id"),
  "answer" text NOT NULL,
  "answered_at" timestamp with time zone DEFAULT now() NOT NULL,
  "source" text NOT NULL,
  "decision" text,
  "client_text" text,
  "staff_note" text,
  "decided_by" uuid,
  "decided_at" timestamp with time zone,
  CONSTRAINT "client_employer_status_answer_chk" CHECK ("answer" in ('nincs', 'alkalmazott', 'efo', 'mindketto', 'hamarosan')),
  CONSTRAINT "client_employer_status_source_chk" CHECK ("source" in ('onboarding', 'havi_ellenorzes', 'konyvelo')),
  CONSTRAINT "client_employer_status_decision_chk" CHECK ("decision" in ('nincs_teendo', 'berszamfejtes_mashol', 'egyedi_ajanlat', 'egyedi_elfogadva', 'nem_vallaljuk'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscription_pauses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL REFERENCES "clients"("id"),
  "from" date NOT NULL,
  "to" date,
  "fee_kind" text DEFAULT 'szuneteltetesi_dij' NOT NULL,
  "source" text NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "subscription_pauses_source_chk" CHECK ("source" in ('valtozas', 'konyvelo'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_pauses_client_id_from_index" ON "subscription_pauses" ("client_id", "from");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reserve_marks" (
  "client_id" uuid NOT NULL REFERENCES "clients"("id"),
  "year" integer NOT NULL,
  "marked_huf" bigint NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "reserve_marks_client_id_year_pk" PRIMARY KEY ("client_id", "year")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mailbox_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  "sender_masked" text NOT NULL,
  "status" text NOT NULL,
  "reason" text,
  "attachments" integer DEFAULT 0 NOT NULL,
  "document_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
  CONSTRAINT "mailbox_log_status_chk" CHECK ("status" in ('elfogadva', 'elutasitva'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mailbox_log_client_id_received_at_index" ON "mailbox_log" ("client_id", "received_at");
--> statement-breakpoint
ALTER TABLE "client_tax_profiles" ADD COLUMN IF NOT EXISTS "regime" text DEFAULT 'atalany' NOT NULL;
--> statement-breakpoint
ALTER TABLE "client_tax_profiles" ADD COLUMN IF NOT EXISTS "kata_from" date;
--> statement-breakpoint
ALTER TABLE "client_tax_profiles" ADD COLUMN IF NOT EXISTS "kata_to" date;
--> statement-breakpoint
ALTER TABLE "client_tax_profiles" DROP CONSTRAINT IF EXISTS "client_tax_profiles_regime_chk";
--> statement-breakpoint
ALTER TABLE "client_tax_profiles" ADD CONSTRAINT "client_tax_profiles_regime_chk" CHECK ("regime" in ('atalany', 'kata'));
--> statement-breakpoint
ALTER TABLE "nav_invoices" ADD COLUMN IF NOT EXISTS "customer_vat_status" text;
--> statement-breakpoint
ALTER TABLE "revenue_items" ADD COLUMN IF NOT EXISTS "payer_kind" text;
--> statement-breakpoint
ALTER TABLE "revenue_items" DROP CONSTRAINT IF EXISTS "revenue_items_payer_kind_chk";
--> statement-breakpoint
ALTER TABLE "revenue_items" ADD CONSTRAINT "revenue_items_payer_kind_chk" CHECK ("payer_kind" in ('maganszemely', 'kifizeto', 'kulfoldi_kifizeto', 'ismeretlen'));
--> statement-breakpoint
ALTER TABLE "business_registrations" ADD COLUMN IF NOT EXISTS "tax_regime" text;
--> statement-breakpoint
ALTER TABLE "accountants" ALTER COLUMN "response_time_text" SET DEFAULT 'A lehető leggyorsabban válaszol';
--> statement-breakpoint
ALTER TABLE "callback_requests" DROP CONSTRAINT IF EXISTS "callback_requests_topic_chk";
--> statement-breakpoint
ALTER TABLE "callback_requests" ADD CONSTRAINT "callback_requests_topic_chk" CHECK ("topic" in ('bekotes', 'vallalkozas_inditas', 'meghatalmazas', 'azonositas', 'elofizetes', 'ado_befizetes', 'szamlak_iratok', 'egyeb', 'vallalkozas_bejelentes_helyettem', 'meghatalmazas_helyettem', 'valtozas', 'valtozas_helyettem', 'eves_zaras', 'adozasi_mod'));
--> statement-breakpoint
ALTER TABLE "callback_requests" DROP CONSTRAINT IF EXISTS "callback_requests_source_chk";
--> statement-breakpoint
ALTER TABLE "callback_requests" ADD CONSTRAINT "callback_requests_source_chk" CHECK ("source" in ('bekotes', 'adatok', 'vallalkozas_adatlap', 'vallalkozas_utmutato', 'meghatalmazas_utmutato', 'azonositas', 'elofizetes', 'uzenetek', 'fiok', 'gyik', 'konyvelo_kartya', 'zarolt_funkcio', 'csapat', 'regi_idopont', 'helyettunk_vallalkozas', 'helyettunk_meghatalmazas', 'utvaltas', 'valtozas_utmutato', 'helyettunk_valtozas', 'kedvezmenyek', 'felretesz', 'kereset', 'havi_ellenorzes', 'eves_zaras', 'kalkulator', 'zarolas', 'alkalmazott', 'adoszam_kereso', 'kata'));
