-- k8 ALAP-B (2026-11-21): bank transfer with díjbekérő, customer numbers, the HTML image of the DEMO mails.
-- ADDITIVE ONLY: one new table, new nullable / defaulted columns, one sequence. The only write to existing rows is the
-- first fill of the NEW column clients.customer_no (in created_at order, only where it is still null). No existing
-- column is changed. up.sh makes the encrypted pg_dump before this runs. Uses no enum value added by 0027.

-- ---------- customer number (ADZ-<ügyfélszám>), 10001 onwards ----------
CREATE SEQUENCE IF NOT EXISTS "clients_customer_no_seq" START WITH 10001 MINVALUE 1;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "customer_no" integer;--> statement-breakpoint
UPDATE "clients" c SET "customer_no" = n.no
  FROM (
    SELECT x."id", (SELECT COALESCE(MAX("customer_no"), 10000) FROM "clients") + ROW_NUMBER() OVER (ORDER BY x."created_at", x."id") AS no
    FROM "clients" x WHERE x."customer_no" IS NULL
  ) n
  WHERE c."id" = n."id" AND c."customer_no" IS NULL;--> statement-breakpoint
SELECT setval('"clients_customer_no_seq"', GREATEST((SELECT COALESCE(MAX("customer_no"), 10000) FROM "clients"), 10000), true);--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "customer_no" SET DEFAULT nextval('"clients_customer_no_seq"');--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "clients_customer_no_uq" ON "clients" USING btree ("customer_no");--> statement-breakpoint

-- ---------- subscriptions: card or transfer ----------
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "billing_method" text DEFAULT 'kartya' NOT NULL CONSTRAINT "subscriptions_billing_method_chk" CHECK ("billing_method" in ('kartya', 'atutalas'));--> statement-breakpoint

-- ---------- transfer_requests: one díjbekérő ----------
CREATE TABLE IF NOT EXISTS "transfer_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL REFERENCES "clients"("id"),
  "subscription_id" uuid,
  "kind" text NOT NULL CONSTRAINT "transfer_requests_kind_chk" CHECK ("kind" in ('elso_havi', 'havi', 'egyszeri')),
  "period_start" date,
  "period_end" date,
  "amount_huf" integer NOT NULL CONSTRAINT "transfer_requests_amount_chk" CHECK ("amount_huf" > 0),
  "order_no" text NOT NULL,
  "kozlemeny" text NOT NULL,
  "proforma_number" text,
  "proforma_pdf_file_id" uuid,
  "issued_on" date NOT NULL,
  "due_on" date NOT NULL,
  "status" text DEFAULT 'kiallitva' NOT NULL CONSTRAINT "transfer_requests_status_chk" CHECK ("status" in ('kiallitva', 'fizetve', 'kesik', 'visszavonva', 'hiba')),
  "paid_on" date,
  "paid_amount_huf" integer,
  "paid_source" text CONSTRAINT "transfer_requests_paid_source_chk" CHECK ("paid_source" is null or "paid_source" in ('autokassza', 'kezi', 'demo')),
  "payment_id" uuid,
  "last_checked_at" timestamp with time zone,
  "reminders_sent" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "mode" text NOT NULL CONSTRAINT "transfer_requests_mode_chk" CHECK ("mode" in ('demo', 'teszt', 'eles')),
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_error_code" text,
  "error" text,
  "note" text,
  "adopted_invoice_number" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "transfer_requests_order_no_uq" ON "transfer_requests" USING btree ("order_no");--> statement-breakpoint
-- at most one live díjbekérő per subscription month, and one open first-month díjbekérő per client
CREATE UNIQUE INDEX IF NOT EXISTS "transfer_requests_one_per_period" ON "transfer_requests" USING btree ("subscription_id", "period_start") WHERE "kind" = 'havi' AND "status" <> 'visszavonva';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "transfer_requests_one_open_first" ON "transfer_requests" USING btree ("client_id") WHERE "kind" = 'elso_havi' AND "status" in ('kiallitva', 'kesik', 'hiba');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transfer_requests_status_due_idx" ON "transfer_requests" USING btree ("status", "due_on");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transfer_requests_client_idx" ON "transfer_requests" USING btree ("client_id", "created_at");--> statement-breakpoint

-- ---------- the DEMO outbox keeps the HTML image of the new template (panel "Levél képe") ----------
ALTER TABLE "demo_outbox" ADD COLUMN IF NOT EXISTS "body_html" text;--> statement-breakpoint

-- ---------- k8 B7 (prepared, not used yet): two-step sign-in with an e-mail code for clients ----------
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_email_enabled_at" timestamp with time zone;
