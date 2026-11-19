-- SPEC §28.7.1 (2): five new features of 2026-11-19 (additive; pg_dump to /srv/kezjegy/_regi/ before).
CREATE TABLE IF NOT EXISTS "user_notification_settings" (
  "user_id" uuid PRIMARY KEY NOT NULL REFERENCES "users"("id"),
  "quiet_enabled" boolean DEFAULT true NOT NULL,
  "quiet_from" smallint DEFAULT 20 NOT NULL,
  "quiet_to" smallint DEFAULT 8 NOT NULL,
  "push_show_amounts" boolean DEFAULT true NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "uns_quiet_from_chk" CHECK ("quiet_from" between 0 and 23),
  CONSTRAINT "uns_quiet_to_chk" CHECK ("quiet_to" between 0 and 23)
);
--> statement-breakpoint
ALTER TABLE "nav_invoices" ADD COLUMN IF NOT EXISTS "notify_state" text;
--> statement-breakpoint
ALTER TABLE "nav_invoices" ADD COLUMN IF NOT EXISTS "notified_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "nav_invoices" ADD COLUMN IF NOT EXISTS "notification_id" uuid;
--> statement-breakpoint
ALTER TABLE "nav_invoices" DROP CONSTRAINT IF EXISTS "nav_invoices_notify_state_chk";
--> statement-breakpoint
ALTER TABLE "nav_invoices" ADD CONSTRAINT "nav_invoices_notify_state_chk" CHECK ("notify_state" in ('kuldve', 'osszevonva', 'kihagyva_elso_szinkron', 'kihagyva_regi', 'kihagyva_modositas', 'kihagyva_zarolt'));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nav_invoices_notify_pending_idx" ON "nav_invoices" ("client_id") WHERE notify_state is null;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reserve_years" (
  "client_id" uuid NOT NULL REFERENCES "clients"("id"),
  "year" integer NOT NULL,
  "inputs_hash" text NOT NULL,
  "base_huf" bigint NOT NULL,
  "total_huf" bigint NOT NULL,
  "fixed_by_month" jsonb NOT NULL,
  "engine_version" text NOT NULL,
  "computed_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "reserve_years_client_id_year_pk" PRIMARY KEY ("client_id", "year")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "revenue_reserves" (
  "revenue_item_id" uuid PRIMARY KEY NOT NULL REFERENCES "revenue_items"("id"),
  "client_id" uuid NOT NULL REFERENCES "clients"("id"),
  "year" integer NOT NULL,
  "seq" integer NOT NULL,
  "raw_huf" bigint NOT NULL,
  "reserve_huf" bigint NOT NULL,
  "szja_huf" bigint NOT NULL,
  "tb_huf" bigint NOT NULL,
  "szocho_huf" bigint NOT NULL,
  "zone" text NOT NULL,
  "crosses_tax_free" boolean DEFAULT false NOT NULL,
  "estimated" boolean DEFAULT false NOT NULL,
  "computed_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "revenue_reserves_zone_chk" CHECK ("zone" in ('adomentes', 'nem_novel', 'csak_szja', 'teljes', 'kedvezmeny', 'sztorno', 'nincs_adat'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "revenue_reserves_client_id_year_seq_index" ON "revenue_reserves" ("client_id", "year", "seq");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "allowance_answers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL REFERENCES "clients"("id"),
  "year" integer NOT NULL,
  "gate" text,
  "answers" jsonb,
  "version" integer DEFAULT 0 NOT NULL,
  "submitted_at" timestamp with time zone,
  "health_consent_at" timestamp with time zone,
  "health_consent_version" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "allowance_answers_gate_chk" CHECK ("gate" in ('lehet', 'nem_jar', 'kesobb'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "allowance_answers_client_id_year_index" ON "allowance_answers" ("client_id", "year");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_allowances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL REFERENCES "clients"("id"),
  "year" integer NOT NULL,
  "kind" text NOT NULL,
  "status" text DEFAULT 'javasolt' NOT NULL,
  "months" smallint[] DEFAULT '{}'::smallint[] NOT NULL,
  "params" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "params_prev" jsonb,
  "in_year" boolean DEFAULT true NOT NULL,
  "proposal" jsonb,
  "answers_version" integer DEFAULT 0 NOT NULL,
  "decided_by" uuid REFERENCES "users"("id"),
  "decided_at" timestamp with time zone,
  "reject_reason" text,
  "client_text" text,
  "staff_note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "client_allowances_kind_chk" CHECK ("kind" in ('anya30', 'anyak', 'fiatal25', 'szemelyi', 'elso_hazasok', 'csaladi', 'csed_gyed')),
  CONSTRAINT "client_allowances_status_chk" CHECK ("status" in ('javasolt', 'kerdes', 'jovahagyva', 'elutasitva', 'visszavonva')),
  CONSTRAINT "client_allowances_reject_reason_chk" CHECK ("reject_reason" in ('kor', 'nem_jogosult', 'mas_veszi_igenybe', 'nincs_jovedelem', 'igazolas_hianyzik', 'egyeb'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "client_allowances_client_id_year_kind_index" ON "client_allowances" ("client_id", "year", "kind");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "client_allowances_pending_idx" ON "client_allowances" ("status") WHERE status in ('javasolt', 'kerdes');
--> statement-breakpoint
ALTER TABLE "assist_requests" ADD COLUMN IF NOT EXISTS "change_data" jsonb;
--> statement-breakpoint
ALTER TABLE "assist_requests" ADD COLUMN IF NOT EXISTS "change_effective_on" date;
--> statement-breakpoint
ALTER TABLE "assist_requests" ADD COLUMN IF NOT EXISTS "change_ready_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "assist_requests" ADD COLUMN IF NOT EXISTS "change_ready_by" uuid REFERENCES "users"("id");
--> statement-breakpoint
ALTER TABLE "assist_requests" ADD COLUMN IF NOT EXISTS "change_done_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "assist_requests" ADD COLUMN IF NOT EXISTS "change_done_by" uuid REFERENCES "users"("id");
--> statement-breakpoint
ALTER TABLE "assist_requests" ADD COLUMN IF NOT EXISTS "followups" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "assist_requests" DROP CONSTRAINT IF EXISTS "assist_requests_kind_chk";
--> statement-breakpoint
ALTER TABLE "assist_requests" ADD CONSTRAINT "assist_requests_kind_chk" CHECK ("kind" in ('vallalkozas_bejelentes', 'meghatalmazas', 'valtozas_szekhely', 'valtozas_tevekenyseg', 'valtozas_telephely', 'valtozas_szuneteltetes', 'valtozas_adoadat', 'valtozas_folytatas'));
--> statement-breakpoint
ALTER TABLE "callback_requests" DROP CONSTRAINT IF EXISTS "callback_requests_topic_chk";
--> statement-breakpoint
ALTER TABLE "callback_requests" ADD CONSTRAINT "callback_requests_topic_chk" CHECK ("topic" in ('bekotes', 'vallalkozas_inditas', 'meghatalmazas', 'azonositas', 'elofizetes', 'ado_befizetes', 'szamlak_iratok', 'egyeb', 'vallalkozas_bejelentes_helyettem', 'meghatalmazas_helyettem', 'valtozas', 'valtozas_helyettem', 'eves_zaras', 'adozasi_mod'));
--> statement-breakpoint
ALTER TABLE "callback_requests" DROP CONSTRAINT IF EXISTS "callback_requests_source_chk";
--> statement-breakpoint
ALTER TABLE "callback_requests" ADD CONSTRAINT "callback_requests_source_chk" CHECK ("source" in ('bekotes', 'adatok', 'vallalkozas_adatlap', 'vallalkozas_utmutato', 'meghatalmazas_utmutato', 'azonositas', 'elofizetes', 'uzenetek', 'fiok', 'gyik', 'konyvelo_kartya', 'zarolt_funkcio', 'csapat', 'regi_idopont', 'helyettunk_vallalkozas', 'helyettunk_meghatalmazas', 'utvaltas', 'valtozas_utmutato', 'helyettunk_valtozas', 'kedvezmenyek', 'felretesz', 'kereset', 'havi_ellenorzes', 'eves_zaras', 'kalkulator', 'zarolas', 'alkalmazott', 'adoszam_kereso', 'kata'));
