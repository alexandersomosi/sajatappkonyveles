-- SPEC §32.B (éves ciklus, F2/F3 – 2026-11-21). ADDITIVE ONLY: new nullable / defaulted columns, two new tables and their
-- indexes; no existing row or column is changed. up.sh makes the encrypted pg_dump before this runs. Uses no enum value
-- added by 0024.

-- tax_periods: the NAV iktatószám of a filing, the önellenőrzés a payment period belongs to
ALTER TABLE "tax_periods" ADD COLUMN IF NOT EXISTS "filing_ref" text;--> statement-breakpoint
ALTER TABLE "tax_periods" ADD COLUMN IF NOT EXISTS "correction_id" uuid;--> statement-breakpoint

-- tax_payment_items: the folyószámla reconciliation that verified the item
ALTER TABLE "tax_payment_items" ADD COLUMN IF NOT EXISTS "reconciliation_id" uuid;--> statement-breakpoint

-- client_tax_profiles: the previous year's HIPA (the sávos advance, Htv. 39/A. § (9))
ALTER TABLE "client_tax_profiles" ADD COLUMN IF NOT EXISTS "hipa_prior_year_huf" integer;--> statement-breakpoint
ALTER TABLE "client_tax_profiles" ADD COLUMN IF NOT EXISTS "hipa_prior_year_source" text;--> statement-breakpoint

-- annual_closings: amounts, approval of the numbers, filing, difference, refund, the yearly HIPA, manual open / close
ALTER TABLE "annual_closings" ADD COLUMN IF NOT EXISTS "amounts" jsonb;--> statement-breakpoint
ALTER TABLE "annual_closings" ADD COLUMN IF NOT EXISTS "amounts_set_by" uuid;--> statement-breakpoint
ALTER TABLE "annual_closings" ADD COLUMN IF NOT EXISTS "amounts_set_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "annual_closings" ADD COLUMN IF NOT EXISTS "engine_estimate" jsonb;--> statement-breakpoint
ALTER TABLE "annual_closings" ADD COLUMN IF NOT EXISTS "letter_text" text;--> statement-breakpoint
ALTER TABLE "annual_closings" ADD COLUMN IF NOT EXISTS "approved_summary" jsonb;--> statement-breakpoint
ALTER TABLE "annual_closings" ADD COLUMN IF NOT EXISTS "diff_huf" integer;--> statement-breakpoint
ALTER TABLE "annual_closings" ADD COLUMN IF NOT EXISTS "filed_szja_on" date;--> statement-breakpoint
ALTER TABLE "annual_closings" ADD COLUMN IF NOT EXISTS "szja_filing_ref" text;--> statement-breakpoint
ALTER TABLE "annual_closings" ADD COLUMN IF NOT EXISTS "szja_return_document_id" uuid;--> statement-breakpoint
ALTER TABLE "annual_closings" ADD COLUMN IF NOT EXISTS "szja_receipt_document_id" uuid;--> statement-breakpoint
ALTER TABLE "annual_closings" ADD COLUMN IF NOT EXISTS "filed_without_approval_note" text;--> statement-breakpoint
ALTER TABLE "annual_closings" ADD COLUMN IF NOT EXISTS "settlement_period_id" uuid;--> statement-breakpoint
ALTER TABLE "annual_closings" ADD COLUMN IF NOT EXISTS "refund_mode" text CONSTRAINT "annual_closings_refund_mode_chk" CHECK ("refund_mode" in ('kiutalas', 'atvezetes'));--> statement-breakpoint
ALTER TABLE "annual_closings" ADD COLUMN IF NOT EXISTS "refund_expected_by" date;--> statement-breakpoint
ALTER TABLE "annual_closings" ADD COLUMN IF NOT EXISTS "refund_status" text CONSTRAINT "annual_closings_refund_status_chk" CHECK ("refund_status" in ('var', 'megerkezett', 'beszamitva', 'atvezetve'));--> statement-breakpoint
ALTER TABLE "annual_closings" ADD COLUMN IF NOT EXISTS "refund_received_on" date;--> statement-breakpoint
ALTER TABLE "annual_closings" ADD COLUMN IF NOT EXISTS "refund_received_huf" integer;--> statement-breakpoint
ALTER TABLE "annual_closings" ADD COLUMN IF NOT EXISTS "refund_marked_by" text;--> statement-breakpoint
ALTER TABLE "annual_closings" ADD COLUMN IF NOT EXISTS "refund_note" text;--> statement-breakpoint
ALTER TABLE "annual_closings" ADD COLUMN IF NOT EXISTS "hipa_needed" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "annual_closings" ADD COLUMN IF NOT EXISTS "hipa_amounts" jsonb;--> statement-breakpoint
ALTER TABLE "annual_closings" ADD COLUMN IF NOT EXISTS "filed_hipa_on" date;--> statement-breakpoint
ALTER TABLE "annual_closings" ADD COLUMN IF NOT EXISTS "hipa_filing_ref" text;--> statement-breakpoint
ALTER TABLE "annual_closings" ADD COLUMN IF NOT EXISTS "hipa_return_document_id" uuid;--> statement-breakpoint
ALTER TABLE "annual_closings" ADD COLUMN IF NOT EXISTS "hipa_receipt_document_id" uuid;--> statement-breakpoint
ALTER TABLE "annual_closings" ADD COLUMN IF NOT EXISTS "hipa_period_id" uuid;--> statement-breakpoint
ALTER TABLE "annual_closings" ADD COLUMN IF NOT EXISTS "closed_manually_reason" text;--> statement-breakpoint
ALTER TABLE "annual_closings" ADD COLUMN IF NOT EXISTS "opened_manually_by" uuid;--> statement-breakpoint
ALTER TABLE "annual_closings" ADD COLUMN IF NOT EXISTS "opened_manually_at" timestamp with time zone;--> statement-breakpoint

-- önellenőrzés (the original period stays untouched; a correction is its own row)
CREATE TABLE IF NOT EXISTS "tax_corrections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL REFERENCES "clients"("id"),
  "form" text NOT NULL,
  "form_label" text NOT NULL,
  "subject_key" text NOT NULL,
  "subject_label" text NOT NULL,
  "original_period_id" uuid,
  "annual_closing_id" uuid,
  "seq" integer DEFAULT 1 NOT NULL,
  "status" text DEFAULT 'tervezet' NOT NULL,
  "cause" text NOT NULL,
  "initiated_by" text DEFAULT 'konyvelo' NOT NULL,
  "reason" text NOT NULL,
  "internal_note" text,
  "diffs" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "potlek_flags" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "potlek_suggested_huf" integer,
  "potlek_basis" jsonb,
  "potlek_huf" integer DEFAULT 0 NOT NULL,
  "potlek_override_reason" text,
  "potlek_approved_by" uuid,
  "potlek_approved_at" timestamp with time zone,
  "potlek_payer" text DEFAULT 'ugyfel' NOT NULL,
  "planned_filed_on" date,
  "onellb_on" date,
  "needs_client_approval" boolean DEFAULT true NOT NULL,
  "no_approval_note" text,
  "approval_hash" text,
  "approved_at" timestamp with time zone,
  "approved_by" uuid,
  "approved_summary" jsonb,
  "filed_on" date,
  "filing_ref" text,
  "return_document_id" uuid,
  "receipt_document_id" uuid,
  "filed_by" uuid,
  "payment_period_id" uuid,
  "cancelled_reason" text,
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "tax_corrections_form_chk" CHECK ("form" in ('2658', 'SZJA', 'KATA', 'HIPA', 'egyeb')),
  CONSTRAINT "tax_corrections_status_chk" CHECK ("status" in ('tervezet', 'ugyfelre_var', 'jovahagyva', 'beadva', 'rendezve', 'visszavonva')),
  CONSTRAINT "tax_corrections_cause_chk" CHECK ("cause" in ('kesoi_irat', 'ugyfel_adat', 'konyvelo_hiba', 'nav_felhivas', 'egyeb')),
  CONSTRAINT "tax_corrections_initiated_by_chk" CHECK ("initiated_by" in ('konyvelo', 'ugyfel', 'nav')),
  CONSTRAINT "tax_corrections_potlek_payer_chk" CHECK ("potlek_payer" in ('ugyfel', 'iroda'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tax_corrections_client_idx" ON "tax_corrections" ("client_id", "created_at" DESC);--> statement-breakpoint

-- NAV folyószámla (adószámla) reconciliation, recorded by hand (M2M later, F4)
CREATE TABLE IF NOT EXISTS "account_reconciliations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" uuid NOT NULL REFERENCES "clients"("id"),
  "kind" text DEFAULT 'rendes' NOT NULL,
  "source" text DEFAULT 'kezi' NOT NULL,
  "as_of" date NOT NULL,
  "period_end" date,
  "balances" jsonb NOT NULL,
  "total_debt_huf" integer DEFAULT 0 NOT NULL,
  "total_overpayment_huf" integer DEFAULT 0 NOT NULL,
  "status" text NOT NULL,
  "follow_up" text DEFAULT 'nincs' NOT NULL,
  "follow_up_note" text,
  "resolved_at" timestamp with time zone,
  "resolved_by" uuid,
  "verified_item_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
  "seen_rows" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "document_id" uuid,
  "correction_id" uuid,
  "request_id" uuid,
  "note" text,
  "next_check_on" date,
  "checked_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "account_reconciliations_kind_chk" CHECK ("kind" in ('rendes', 'nyito')),
  CONSTRAINT "account_reconciliations_source_chk" CHECK ("source" in ('kezi', 'm2m')),
  CONSTRAINT "account_reconciliations_status_chk" CHECK ("status" in ('rendben', 'hatralek', 'tulfizetes', 'elteres')),
  CONSTRAINT "account_reconciliations_follow_up_chk" CHECK ("follow_up" in ('nincs', 'befizetes_kerve', 'atvezetes_kerve', 'kiutalas_kerve', 'eszrevetel', 'onellenorzes'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_reconciliations_client_idx" ON "account_reconciliations" ("client_id", "as_of" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_reconciliations_next_idx" ON "account_reconciliations" ("next_check_on");
