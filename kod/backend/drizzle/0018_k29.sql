-- SPEC §29.12 (k7): Stripe payments, Számlázz.hu fee invoices, prices, owner console, certificates, income statement,
-- calendar feed, guided first run. ADDITIVE ONLY (new tables, new nullable / defaulted columns, widened CHECKs).
-- up.sh makes the encrypted pg_dump before this runs. Uses none of the enum values added by 0017 (same transaction).

-- ---------- §29.1.2 payments ----------
CREATE TABLE IF NOT EXISTS "payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL REFERENCES "clients"("id"),
  "subscription_id" uuid,
  "fee_charge_id" uuid,
  "kind" text NOT NULL,
  "provider" text NOT NULL,
  "mode" text NOT NULL,
  "amount_huf" integer NOT NULL,
  "period_start" date,
  "period_end" date,
  "status" text DEFAULT 'letrehozva' NOT NULL,
  "initiated" text NOT NULL,
  "off_session" boolean DEFAULT false NOT NULL,
  "attempt_day" date,
  "idempotency_key" text NOT NULL,
  "stripe_payment_intent_id" text,
  "stripe_checkout_session_id" text,
  "stripe_charge_id" text,
  "stripe_setup_intent_id" text,
  "hosted_url_enc" text,
  "hosted_expires_at" timestamp with time zone,
  "hosted_mode" text,
  "save_card" boolean DEFAULT false NOT NULL,
  "platform" text,
  "return_origin" text,
  "cel" text,
  "consent_id" uuid,
  "payment_method_id" uuid,
  "failure_code" text,
  "decline_code" text,
  "card_brand" text,
  "card_last4" text,
  "refunded_huf" integer DEFAULT 0 NOT NULL,
  "refunds" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "dispute_status" text,
  "fee_invoice_id" uuid,
  "alerted_at" timestamp with time zone,
  "applied_at" timestamp with time zone,
  "succeeded_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "payments_idempotency_key_unique" UNIQUE("idempotency_key"),
  CONSTRAINT "payments_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id"),
  CONSTRAINT "payments_stripe_checkout_session_id_unique" UNIQUE("stripe_checkout_session_id"),
  CONSTRAINT "payments_kind_chk" CHECK ("kind" in ('elso_havi', 'havi', 'egyszeri', 'fizesd_ki', 'kartya')),
  CONSTRAINT "payments_status_chk" CHECK ("status" in ('letrehozva', 'feldolgozas', 'hitelesites_kell', 'sikeres', 'sikertelen', 'megszakitva', 'bizonytalan', 'duplikalt')),
  CONSTRAINT "payments_amount_chk" CHECK ("amount_huf" >= 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_client_created_idx" ON "payments" ("client_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_open_status_idx" ON "payments" ("status") WHERE status in ('letrehozva', 'feldolgozas', 'bizonytalan', 'hitelesites_kell');
--> statement-breakpoint
-- At most ONE successful charge per subscription period (§29.0 principle 2): a duplicate success is refunded automatically.
CREATE UNIQUE INDEX IF NOT EXISTS "payments_one_success_per_period" ON "payments" ("subscription_id", "period_start") WHERE kind in ('elso_havi', 'havi', 'fizesd_ki') and status = 'sikeres';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_methods" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL REFERENCES "clients"("id"),
  "provider" text NOT NULL,
  "mode" text NOT NULL,
  "stripe_customer_id" text,
  "stripe_payment_method_id" text,
  "brand" text,
  "last4" text,
  "exp_month" smallint,
  "exp_year" smallint,
  "status" text DEFAULT 'aktiv' NOT NULL,
  "consent_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "detached_at" timestamp with time zone,
  CONSTRAINT "payment_methods_stripe_payment_method_id_unique" UNIQUE("stripe_payment_method_id"),
  CONSTRAINT "payment_methods_status_chk" CHECK ("status" in ('aktiv', 'torolve', 'lejart', 'lecserelve'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_methods_client_idx" ON "payment_methods" ("client_id", "status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stripe_customers" (
  "client_id" uuid NOT NULL REFERENCES "clients"("id"),
  "mode" text NOT NULL,
  "customer_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "stripe_customers_client_id_mode_pk" PRIMARY KEY("client_id", "mode"),
  CONSTRAINT "stripe_customers_customer_id_unique" UNIQUE("customer_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stripe_events" (
  "id" text PRIMARY KEY NOT NULL,
  "type" text NOT NULL,
  "mode" text NOT NULL,
  "stripe_created_at" timestamp with time zone,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  "processed_at" timestamp with time zone,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_error" text
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "provider" text DEFAULT 'simplepay' NOT NULL;
--> statement-breakpoint
-- Backfill: every existing DEMO subscription keeps the demo provider (§29.1.12 – no demo client is locked by the switch).
UPDATE "subscriptions" SET "provider" = 'demo' WHERE "mode" = 'demo' AND "provider" = 'simplepay';
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "payment_method_id" uuid;
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "predebit_notified_for" date;
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "suspension_warned_for" date;
--> statement-breakpoint
ALTER TABLE "fee_charges" ADD COLUMN IF NOT EXISTS "payment_id" uuid;
--> statement-breakpoint

-- ---------- §29.2 fee invoices ----------
ALTER TABLE "fee_invoices" ADD COLUMN IF NOT EXISTS "payment_id" uuid;
--> statement-breakpoint
ALTER TABLE "fee_invoices" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'szamla' NOT NULL;
--> statement-breakpoint
ALTER TABLE "fee_invoices" ADD COLUMN IF NOT EXISTS "external_key" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fee_invoices_external_key_unique" ON "fee_invoices" ("external_key");
--> statement-breakpoint
ALTER TABLE "fee_invoices" ADD COLUMN IF NOT EXISTS "provider_account" text;
--> statement-breakpoint
ALTER TABLE "fee_invoices" ADD COLUMN IF NOT EXISTS "storno_of" uuid;
--> statement-breakpoint
ALTER TABLE "fee_invoices" ADD COLUMN IF NOT EXISTS "attempts" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "fee_invoices" ADD COLUMN IF NOT EXISTS "next_retry_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "fee_invoices" ADD COLUMN IF NOT EXISTS "last_error_code" text;
--> statement-breakpoint
ALTER TABLE "fee_invoices" ADD COLUMN IF NOT EXISTS "buyer" jsonb;
--> statement-breakpoint
ALTER TABLE "fee_invoices" ADD COLUMN IF NOT EXISTS "line" jsonb;
--> statement-breakpoint
ALTER TABLE "fee_invoices" ADD COLUMN IF NOT EXISTS "alerted_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fee_invoices_status_next_retry_idx" ON "fee_invoices" ("status", "next_retry_at");
--> statement-breakpoint

-- ---------- §29.4.1 / §29.12: fee kinds (F1 certificates, F3 closing) ----------
ALTER TABLE "fee_settings" DROP CONSTRAINT IF EXISTS "fee_settings_kind_chk";
--> statement-breakpoint
ALTER TABLE "fee_settings" ADD CONSTRAINT "fee_settings_kind_chk" CHECK ("kind" in ('havidij', 'havidij_kata', 'eves_zaras', 'valtozas_egyszeru', 'valtozas_jogallas', 'szuneteltetesi_dij', 'igazolas_jovedelem', 'igazolas_ado', 'igazolas_koma', 'igazolas_ev_kivonat', 'igazolas_egyeb', 'megszuntetes'));
--> statement-breakpoint
ALTER TABLE "fee_charges" DROP CONSTRAINT IF EXISTS "fee_charges_kind_chk";
--> statement-breakpoint
ALTER TABLE "fee_charges" ADD CONSTRAINT "fee_charges_kind_chk" CHECK ("kind" in ('havidij', 'havidij_kata', 'eves_zaras', 'valtozas_egyszeru', 'valtozas_jogallas', 'szuneteltetesi_dij', 'igazolas_jovedelem', 'igazolas_ado', 'igazolas_koma', 'igazolas_ev_kivonat', 'igazolas_egyeb', 'megszuntetes'));
--> statement-breakpoint
-- §29.7 F3: the closing is a change kind / assist kind; its callback topic.
ALTER TABLE "assist_requests" DROP CONSTRAINT IF EXISTS "assist_requests_kind_chk";
--> statement-breakpoint
ALTER TABLE "assist_requests" ADD CONSTRAINT "assist_requests_kind_chk" CHECK ("kind" in ('vallalkozas_bejelentes', 'meghatalmazas', 'valtozas_szekhely', 'valtozas_tevekenyseg', 'valtozas_telephely', 'valtozas_szuneteltetes', 'valtozas_adoadat', 'valtozas_folytatas', 'valtozas_megszuntetes'));
--> statement-breakpoint
ALTER TABLE "callback_requests" DROP CONSTRAINT IF EXISTS "callback_requests_topic_chk";
--> statement-breakpoint
ALTER TABLE "callback_requests" ADD CONSTRAINT "callback_requests_topic_chk" CHECK ("topic" in ('bekotes', 'vallalkozas_inditas', 'meghatalmazas', 'azonositas', 'elofizetes', 'ado_befizetes', 'szamlak_iratok', 'egyeb', 'vallalkozas_bejelentes_helyettem', 'meghatalmazas_helyettem', 'valtozas', 'valtozas_helyettem', 'eves_zaras', 'adozasi_mod', 'megszuntetes'));
--> statement-breakpoint
-- §29.9.4: a pause opened in the owner console.
ALTER TABLE "subscription_pauses" DROP CONSTRAINT IF EXISTS "subscription_pauses_source_chk";
--> statement-breakpoint
ALTER TABLE "subscription_pauses" ADD CONSTRAINT "subscription_pauses_source_chk" CHECK ("source" in ('valtozas', 'konyvelo', 'admin'));
--> statement-breakpoint

-- ---------- clients (§29.4.4, §29.9, §29.10) ----------
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "guided" jsonb;
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "business_identity_source" text;
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "business_identity" jsonb;
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "service_lock_manual" jsonb;
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "terminated" jsonb;
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "anonymized_at" timestamp with time zone;
--> statement-breakpoint

-- ---------- §29.5 F1 certificates ----------
ALTER TABLE "certificate_requests" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'beerkezett' NOT NULL;
--> statement-breakpoint
ALTER TABLE "certificate_requests" ADD COLUMN IF NOT EXISTS "user_name" text;
--> statement-breakpoint
ALTER TABLE "certificate_requests" ADD COLUMN IF NOT EXISTS "purpose_kind" text;
--> statement-breakpoint
ALTER TABLE "certificate_requests" ADD COLUMN IF NOT EXISTS "purpose_text" text;
--> statement-breakpoint
ALTER TABLE "certificate_requests" ADD COLUMN IF NOT EXISTS "needed_by" date;
--> statement-breakpoint
ALTER TABLE "certificate_requests" ADD COLUMN IF NOT EXISTS "paper_copy" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "certificate_requests" ADD COLUMN IF NOT EXISTS "paper_to" text;
--> statement-breakpoint
ALTER TABLE "certificate_requests" ADD COLUMN IF NOT EXISTS "paper_address" text;
--> statement-breakpoint
ALTER TABLE "certificate_requests" ADD COLUMN IF NOT EXISTS "extended" text;
--> statement-breakpoint
ALTER TABLE "certificate_requests" ADD COLUMN IF NOT EXISTS "official" text;
--> statement-breakpoint
ALTER TABLE "certificate_requests" ADD COLUMN IF NOT EXISTS "english_requested" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "certificate_requests" ADD COLUMN IF NOT EXISTS "other_text" text;
--> statement-breakpoint
ALTER TABLE "certificate_requests" ADD COLUMN IF NOT EXISTS "fee_charge_id" uuid;
--> statement-breakpoint
ALTER TABLE "certificate_requests" ADD COLUMN IF NOT EXISTS "rejected_reason" text;
--> statement-breakpoint
ALTER TABLE "certificate_requests" ADD COLUMN IF NOT EXISTS "iktatoszam" text;
--> statement-breakpoint
ALTER TABLE "certificate_requests" ADD COLUMN IF NOT EXISTS "koma_outcome" text;
--> statement-breakpoint
ALTER TABLE "certificate_requests" ADD COLUMN IF NOT EXISTS "koma_date" date;
--> statement-breakpoint
ALTER TABLE "certificate_requests" ADD COLUMN IF NOT EXISTS "copies" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "certificate_requests" ADD COLUMN IF NOT EXISTS "done_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "certificate_requests" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "certificate_requests_status_idx" ON "certificate_requests" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "certificate_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "request_id" uuid NOT NULL REFERENCES "requests"("id"),
  "status" text NOT NULL,
  "at" timestamp with time zone DEFAULT now() NOT NULL,
  "by" uuid,
  "note" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "certificate_events_request_idx" ON "certificate_events" ("request_id", "at");
--> statement-breakpoint

-- ---------- §29.6 F2 income statement approvals ----------
CREATE TABLE IF NOT EXISTS "income_statement_approvals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL REFERENCES "clients"("id"),
  "from_month" char(7) NOT NULL,
  "to_month" char(7) NOT NULL,
  "data_sha256" text NOT NULL,
  "approved_by" uuid NOT NULL,
  "approved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "income_statement_approvals_uq" ON "income_statement_approvals" ("client_id", "from_month", "to_month", "data_sha256");
--> statement-breakpoint

-- ---------- §29.8 F4 calendar feed ----------
CREATE TABLE IF NOT EXISTS "calendar_feeds" (
  "client_id" uuid PRIMARY KEY NOT NULL REFERENCES "clients"("id"),
  "token_hash" text NOT NULL,
  "token_enc" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "rotated_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "last_fetched_at" timestamp with time zone,
  "fetch_count" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "calendar_feeds_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint

-- ---------- §29.9 F9 owner console ----------
CREATE TABLE IF NOT EXISTS "client_price_overrides" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL REFERENCES "clients"("id"),
  "kind" text NOT NULL,
  "amount_huf" integer,
  "percent" smallint,
  "months" smallint,
  "from_period" date NOT NULL,
  "until_period" date,
  "reason" text NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone,
  "revoked_by" uuid,
  "revoke_reason" text,
  CONSTRAINT "client_price_overrides_kind_chk" CHECK ("kind" in ('egyedi_ar', 'kedvezmeny_szazalek', 'ingyenes_honap'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "client_price_overrides_client_idx" ON "client_price_overrides" ("client_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_step_ups" (
  "session_id" uuid PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL,
  "verified_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "announcements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "channels" jsonb NOT NULL,
  "filter" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "recipient_count" integer DEFAULT 0 NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
