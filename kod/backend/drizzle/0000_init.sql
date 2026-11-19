CREATE TYPE "public"."appointment_status" AS ENUM('foglalt', 'lemondva', 'megtortent', 'elmaradt');--> statement-breakpoint
CREATE TYPE "public"."calc_status" AS ENUM('nincs', 'becsles', 'jovahagyva');--> statement-breakpoint
CREATE TYPE "public"."client_lifecycle" AS ENUM('bekotes_alatt', 'aktiv', 'felfuggesztve', 'megszunt');--> statement-breakpoint
CREATE TYPE "public"."document_category" AS ENUM('nyugta', 'penztargep_osszesito', 'bankszamlakivonat', 'szerzodes', 'koltseg_bizonylat', 'kiallitott_szamla_kezi', 'nav_level', 'bevallas', 'nav_visszaigazolas', 'igazolas', 'meghatalmazas', 'szerzodes_alairt', 'egyeb');--> statement-breakpoint
CREATE TYPE "public"."document_source" AS ENUM('ugyfel', 'konyvelo', 'nav', 'rendszer');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('feltoltve', 'konyvelo_latta', 'feldolgozva', 'beadva');--> statement-breakpoint
CREATE TYPE "public"."legal_doc_type" AS ENUM('aszf', 'adatkezeles', 'megbizasi_szerzodes', 'nav_meghatalmazas', 'adatfeldolgozoi', 'pmt_nyilatkozatok', 'simplepay_adattovabbitas', 'simplepay_ismetlodo', 'app_szovegek');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('tax_approved', 'tax_due_soon', 'tax_reopened', 'tax_payment_verified', 'tax_payment_mismatch', 'tax_filed', 'document_processed', 'document_filed', 'request_new', 'request_reminder', 'request_done', 'message_new', 'client_message_new', 'client_request_new', 'client_document_uploaded', 'client_marked_paid', 'onboarding_needs_review', 'onboarding_needs_fix', 'onboarding_done', 'limit_warning', 'appointment_booked', 'appointment_reminder', 'appointment_cancelled', 'subscription_payment_failed', 'subscription_renewal_needed', 'subscription_canceled', 'fee_invoice_issued', 'auth_email_code', 'auth_password_reset_code', 'auth_staff_invite', 'gdpr_export_ready');--> statement-breakpoint
CREATE TYPE "public"."onboarding_step" AS ENUM('fiok', 'adatok', 'szerzodes', 'elofizetes', 'meghatalmazas', 'azonositas', 'idopont', 'nav_bekotes');--> statement-breakpoint
CREATE TYPE "public"."payment_item_kind" AS ENUM('tb_jarulek', 'szocho', 'szja_eloleg', 'hipa_eloleg', 'hipa_kulonbozet');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('nincs_fizetendo', 'fizetendo', 'befizetve_jelezve', 'ellenorizve', 'elteres');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('nyitott', 'folyamatban', 'teljesitve', 'elutasitva', 'visszavonva');--> statement-breakpoint
CREATE TYPE "public"."step_status" AS ENUM('nincs_kezdve', 'ugyfelre_var', 'konyvelore_var', 'hianyos', 'kesz', 'kihagyva');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('incomplete', 'active', 'past_due', 'suspended', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."tax_status" AS ENUM('fofoglalkozasu', 'mellekallasu', 'nyugdijas');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('client', 'accountant', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'disabled', 'pending_deletion', 'deleted');--> statement-breakpoint
CREATE TABLE "accountants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"first_name" text NOT NULL,
	"title" text DEFAULT 'Mérlegképes könyvelő' NOT NULL,
	"registration_number" text,
	"adoazonosito_jel_enc" text,
	"avatar_key" text DEFAULT 'karakter_1_lapos' NOT NULL,
	"signature_svg_path" text,
	"name_with" text,
	"name_from" text,
	"name_onto" text,
	"name_acc" text,
	"response_time_text" text DEFAULT 'Munkanapokon 4 órán belül válaszol' NOT NULL,
	"appointments_enabled" boolean DEFAULT false NOT NULL,
	"monthly_statement_request" boolean DEFAULT true NOT NULL,
	"capacity" integer DEFAULT 150 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accountants_userId_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"accountant_id" uuid NOT NULL,
	"slot_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"channel" text NOT NULL,
	"phone_enc" text,
	"video_link" text,
	"topic" text,
	"status" "appointment_status" DEFAULT 'foglalt' NOT NULL,
	"cancelled_by" uuid,
	"note" text,
	"reminder24h_at" timestamp with time zone,
	"reminder1h_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_user_id" uuid,
	"actor_role" text,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"client_id" uuid,
	"ip_hmac" text,
	"user_agent" text,
	"request_id" text,
	"details" jsonb
);
--> statement-breakpoint
CREATE TABLE "availability_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accountant_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"channels" text[] NOT NULL,
	"status" text DEFAULT 'szabad' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"simplepay_card_id" bigint,
	"order_ref" text,
	"card_mask" text,
	"card_expiry" date,
	"tokens_until" timestamp with time zone,
	"max_amount_huf" integer NOT NULL,
	"status" text DEFAULT 'fuggo' NOT NULL,
	"mode" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificate_requests" (
	"request_id" uuid PRIMARY KEY NOT NULL,
	"certificate_type" text NOT NULL,
	"year" integer,
	"purpose" text NOT NULL,
	"language" text DEFAULT 'hu' NOT NULL,
	"submitted_to_nav_at" timestamp with time zone,
	"document_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_tax_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"cost_ratio" smallint NOT NULL,
	"cost_ratio_source" text DEFAULT 'ugyfel_javaslat' NOT NULL,
	"status" "tax_status" DEFAULT 'fofoglalkozasu' NOT NULL,
	"guaranteed_minimum" boolean DEFAULT false NOT NULL,
	"retail" boolean DEFAULT false NOT NULL,
	"atalany_from" date,
	"insurance_breaks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hipa_method" text DEFAULT 'savos' NOT NULL,
	"hipa_rate_pct" numeric(4, 2) DEFAULT '2.00' NOT NULL,
	"hipa_account_number" text,
	"prior_overrides" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_tax_profiles_cost_ratio_chk" CHECK ("client_tax_profiles"."cost_ratio" in (45, 80, 90))
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"accountant_id" uuid,
	"lifecycle" "client_lifecycle" DEFAULT 'bekotes_alatt' NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"birth_name" text,
	"phone_enc" text,
	"adoazonosito_jel_enc" text,
	"adoazonosito_hmac" text,
	"adoazonosito_last3" text,
	"adoszam" text,
	"ev_nyilvantartasi_szam" text,
	"address_zip" text,
	"address_city" text,
	"address_line" text,
	"hq_municipality" text,
	"activity_text" text,
	"activity_answer" text,
	"activity_code" text,
	"ev_since" date,
	"previous_accountant" text,
	"has_separate_business_account" boolean,
	"referral_code_id" uuid,
	"attribution" jsonb,
	"next_flags" jsonb,
	"personal_referral_code" text,
	"alairt_pdf_allowed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clients_userId_unique" UNIQUE("user_id"),
	CONSTRAINT "clients_personalReferralCode_unique" UNIQUE("personal_referral_code")
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"doc_type" "legal_doc_type" NOT NULL,
	"version" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_hmac" text,
	"user_agent" text,
	"withdrawn_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_texts" (
	"key" text PRIMARY KEY NOT NULL,
	"body" text NOT NULL,
	"placeholders" text[] DEFAULT '{}'::text[] NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deadlines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"due_date" date NOT NULL,
	"period_key" text,
	"related_period_id" uuid,
	"related_request_id" uuid,
	"related_appointment_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demo_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to_hash" text NOT NULL,
	"to_display" text NOT NULL,
	"subject" text NOT NULL,
	"body_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"from_status" "document_status",
	"to_status" "document_status" NOT NULL,
	"changed_by" uuid,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"version_no" integer NOT NULL,
	"file_id" uuid NOT NULL,
	"page_count" integer DEFAULT 1 NOT NULL,
	"thumb_file_id" uuid,
	"uploaded_by" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"dossier_month" char(7) NOT NULL,
	"source" "document_source" NOT NULL,
	"category" "document_category" NOT NULL,
	"title" text NOT NULL,
	"status" "document_status" DEFAULT 'feltoltve' NOT NULL,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"visibility" text DEFAULT 'kozos' NOT NULL,
	"document_date" date,
	"amount_huf" bigint,
	"current_version_id" uuid,
	"client_note" text,
	"accountant_comment" text,
	"related_period_id" uuid,
	"related_request_id" uuid,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dossiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"month" char(7) NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"summary_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"email" text NOT NULL,
	"purpose" text NOT NULL,
	"code_hmac" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faq_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fee_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"simplepay_transaction_id" uuid,
	"provider" text NOT NULL,
	"number" text,
	"issued_on" date,
	"amount_huf" integer NOT NULL,
	"pdf_file_id" uuid,
	"external_id" text,
	"status" text NOT NULL,
	"error" text,
	"demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_client_id" uuid,
	"kind" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"key_id" smallint NOT NULL,
	"storage_path" text NOT NULL,
	"display_name" text NOT NULL,
	"created_by" uuid,
	"retention_until" date,
	"legal_hold" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gdpr_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text DEFAULT 'keszul' NOT NULL,
	"file_id" uuid,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "internal_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"status" text DEFAULT 'bekuldve' NOT NULL,
	"data_enc" text NOT NULL,
	"declarations" jsonb NOT NULL,
	"files" jsonb NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"relationship_ended_at" timestamp with time zone,
	"retention_until" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doc_type" "legal_doc_type" NOT NULL,
	"version" text NOT NULL,
	"title" text NOT NULL,
	"source_path" text NOT NULL,
	"sha256" text NOT NULL,
	"effective_from" date,
	"requires_reconsent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_attachments" (
	"message_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	CONSTRAINT "message_attachments_message_id_file_id_pk" PRIMARY KEY("message_id","file_id")
);
--> statement-breakpoint
CREATE TABLE "message_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accountant_id" uuid,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"sender_user_id" uuid,
	"sender_role" text NOT NULL,
	"kind" text DEFAULT 'szoveg' NOT NULL,
	"body" text NOT NULL,
	"request_id" uuid,
	"document_id" uuid,
	"read_by_client_at" timestamp with time zone,
	"read_by_accountant_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nav_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"tax_number" char(8) NOT NULL,
	"secret_enc" text NOT NULL,
	"login_hint" text NOT NULL,
	"environment" text NOT NULL,
	"status" text DEFAULT 'nincs_ellenorizve' NOT NULL,
	"last_test_at" timestamp with time zone,
	"last_test_error" text,
	"last_sync_at" timestamp with time zone,
	"last_sync_status" text,
	"last_sync_error" text,
	"sync_cursor_ins_date" timestamp with time zone,
	"saved_by" uuid,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nav_credentials_clientId_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "nav_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"invoice_number" text NOT NULL,
	"batch_index" integer,
	"operation" text NOT NULL,
	"category" text NOT NULL,
	"issue_date" date NOT NULL,
	"delivery_date" date,
	"payment_date" date,
	"payment_method" text,
	"currency" text DEFAULT 'HUF' NOT NULL,
	"net_huf" bigint NOT NULL,
	"vat_huf" bigint NOT NULL,
	"gross_huf" bigint NOT NULL,
	"customer_name" text,
	"customer_tax_number" text,
	"original_invoice_number" text,
	"modification_index" integer,
	"mod_key" integer DEFAULT 0 NOT NULL,
	"ins_date" timestamp with time zone,
	"transaction_id" text,
	"data" jsonb,
	"raw_xml_file_id" uuid,
	"dossier_month" char(7) NOT NULL,
	"status" "document_status" DEFAULT 'feltoltve' NOT NULL,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nav_sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'fut' NOT NULL,
	"digests_seen" integer DEFAULT 0 NOT NULL,
	"invoices_new" integer DEFAULT 0 NOT NULL,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_prefs" (
	"user_id" uuid NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"push" boolean NOT NULL,
	"email" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_prefs_user_id_kind_pk" PRIMARY KEY("user_id","kind")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link" text,
	"data" jsonb,
	"want_push" boolean DEFAULT false NOT NULL,
	"want_email" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"push_sent_at" timestamp with time zone,
	"email_sent_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_steps" (
	"client_id" uuid NOT NULL,
	"step" "onboarding_step" NOT NULL,
	"status" "step_status" DEFAULT 'nincs_kezdve' NOT NULL,
	"data" jsonb,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "onboarding_steps_client_id_step_pk" PRIMARY KEY("client_id","step")
);
--> statement-breakpoint
CREATE TABLE "payment_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_registration_id" uuid NOT NULL,
	"token_enc" text NOT NULL,
	"seq" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'fuggo' NOT NULL,
	"used_at" timestamp with time zone,
	"used_order_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"price_huf" integer NOT NULL,
	"interval" text DEFAULT 'month' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"platform" text NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "referral_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"owner_client_id" uuid,
	"campaign" text,
	"note" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referral_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"dossier_month" char(7),
	"due_date" date,
	"status" "request_status" DEFAULT 'nyitott' NOT NULL,
	"result_document_id" uuid,
	"created_by" uuid,
	"completed_at" timestamp with time zone,
	"completed_by" uuid,
	"status_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revenue_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"source" text NOT NULL,
	"nav_invoice_id" uuid,
	"document_id" uuid,
	"received_on" date NOT NULL,
	"received_on_estimated" boolean DEFAULT false NOT NULL,
	"delivery_date" date NOT NULL,
	"amount_huf" bigint NOT NULL,
	"description" text NOT NULL,
	"counts_for_atalany" boolean DEFAULT true NOT NULL,
	"counts_for_afa_limit" boolean DEFAULT true NOT NULL,
	"excluded_reason" text,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"refresh_hash" text NOT NULL,
	"rotated_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"idle_expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"client_kind" text NOT NULL,
	"user_agent" text,
	"ip_hmac" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_refreshHash_unique" UNIQUE("refresh_hash")
);
--> statement-breakpoint
CREATE TABLE "signup_attribution" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"referral_code_id" uuid,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_content" text,
	"landing" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simplepay_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_ref" text NOT NULL,
	"simplepay_transaction_id" bigint,
	"kind" text NOT NULL,
	"client_id" uuid NOT NULL,
	"subscription_id" uuid,
	"card_registration_id" uuid,
	"token_id" uuid,
	"amount_huf" integer NOT NULL,
	"currency" text DEFAULT 'HUF' NOT NULL,
	"status" text DEFAULT 'INIT' NOT NULL,
	"period_start" date,
	"period_end" date,
	"error_codes" text[],
	"ipn_count" integer DEFAULT 0 NOT NULL,
	"last_ipn_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"applied_at" timestamp with time zone,
	"platform" text,
	"mode" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "simplepay_transactions_orderRef_unique" UNIQUE("order_ref")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"plan_code" text NOT NULL,
	"status" "subscription_status" DEFAULT 'incomplete' NOT NULL,
	"current_period_start" date,
	"current_period_end" date,
	"next_charge_at" timestamp with time zone,
	"next_retry_at" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp with time zone,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"first_failed_at" timestamp with time zone,
	"last_failure_code" text,
	"grace_until" date,
	"card_registration_id" uuid,
	"renewal_notified_at" timestamp with time zone,
	"mode" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_clientId_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "system_state" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_calculations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tax_period_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"engine_version" text NOT NULL,
	"rules_version" text NOT NULL,
	"as_of" date NOT NULL,
	"input" jsonb NOT NULL,
	"result" jsonb NOT NULL,
	"overrides" jsonb,
	"letter_text" text,
	"calculated_by" uuid,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_payment_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tax_period_id" uuid NOT NULL,
	"calculation_id" uuid,
	"kind" "payment_item_kind" NOT NULL,
	"label" text NOT NULL,
	"sublabel" text,
	"amount_huf" bigint NOT NULL,
	"due_date" date NOT NULL,
	"account_name" text NOT NULL,
	"account_number" text NOT NULL,
	"iban" text NOT NULL,
	"reference" text NOT NULL,
	"marked_paid_at" timestamp with time zone,
	"marked_paid_on" date,
	"verified_at" timestamp with time zone,
	"verified_by" uuid,
	"verification" text,
	"verification_note" text,
	"voided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"period_key" text NOT NULL,
	"year" integer NOT NULL,
	"quarter" integer,
	"due_date" date NOT NULL,
	"calc_status" "calc_status" DEFAULT 'nincs' NOT NULL,
	"payment_status" "payment_status" DEFAULT 'nincs_fizetendo' NOT NULL,
	"filing_status" text DEFAULT 'nincs' NOT NULL,
	"approved_calculation_id" uuid,
	"latest_calculation_id" uuid,
	"filed_at" timestamp with time zone,
	"filed_on" date,
	"filed_by" uuid,
	"filing_form" text,
	"return_document_id" uuid,
	"receipt_document_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"password_hash" text,
	"role" "user_role" NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"display_name" text,
	"google_sub" text,
	"apple_sub" text,
	"totp_secret_enc" text,
	"totp_pending_enc" text,
	"totp_enabled_at" timestamp with time zone,
	"recovery_codes" jsonb,
	"failed_logins" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"deletion_requested_at" timestamp with time zone,
	"deletion_due_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_googleSub_unique" UNIQUE("google_sub"),
	CONSTRAINT "users_appleSub_unique" UNIQUE("apple_sub")
);
--> statement-breakpoint
ALTER TABLE "accountants" ADD CONSTRAINT "accountants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_accountant_id_accountants_id_fk" FOREIGN KEY ("accountant_id") REFERENCES "public"."accountants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_slot_id_availability_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."availability_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_accountant_id_accountants_id_fk" FOREIGN KEY ("accountant_id") REFERENCES "public"."accountants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_registrations" ADD CONSTRAINT "card_registrations_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificate_requests" ADD CONSTRAINT "certificate_requests_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_tax_profiles" ADD CONSTRAINT "client_tax_profiles_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_accountant_id_accountants_id_fk" FOREIGN KEY ("accountant_id") REFERENCES "public"."accountants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_referral_code_id_referral_codes_id_fk" FOREIGN KEY ("referral_code_id") REFERENCES "public"."referral_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_status_history" ADD CONSTRAINT "document_status_history_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_codes" ADD CONSTRAINT "email_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_invoices" ADD CONSTRAINT "fee_invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_invoices" ADD CONSTRAINT "fee_invoices_simplepay_transaction_id_simplepay_transactions_id_fk" FOREIGN KEY ("simplepay_transaction_id") REFERENCES "public"."simplepay_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_owner_client_id_clients_id_fk" FOREIGN KEY ("owner_client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gdpr_exports" ADD CONSTRAINT "gdpr_exports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_notes" ADD CONSTRAINT "internal_notes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_notes" ADD CONSTRAINT "internal_notes_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_records" ADD CONSTRAINT "kyc_records_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nav_credentials" ADD CONSTRAINT "nav_credentials_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nav_invoices" ADD CONSTRAINT "nav_invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nav_sync_runs" ADD CONSTRAINT "nav_sync_runs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_prefs" ADD CONSTRAINT "notification_prefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_steps" ADD CONSTRAINT "onboarding_steps_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_tokens" ADD CONSTRAINT "payment_tokens_card_registration_id_card_registrations_id_fk" FOREIGN KEY ("card_registration_id") REFERENCES "public"."card_registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_items" ADD CONSTRAINT "revenue_items_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signup_attribution" ADD CONSTRAINT "signup_attribution_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simplepay_transactions" ADD CONSTRAINT "simplepay_transactions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_code_plans_code_fk" FOREIGN KEY ("plan_code") REFERENCES "public"."plans"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_card_registration_id_card_registrations_id_fk" FOREIGN KEY ("card_registration_id") REFERENCES "public"."card_registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_calculations" ADD CONSTRAINT "tax_calculations_tax_period_id_tax_periods_id_fk" FOREIGN KEY ("tax_period_id") REFERENCES "public"."tax_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_payment_items" ADD CONSTRAINT "tax_payment_items_tax_period_id_tax_periods_id_fk" FOREIGN KEY ("tax_period_id") REFERENCES "public"."tax_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_periods" ADD CONSTRAINT "tax_periods_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_client_id_at_index" ON "audit_log" USING btree ("client_id","at");--> statement-breakpoint
CREATE INDEX "audit_log_actor_user_id_at_index" ON "audit_log" USING btree ("actor_user_id","at");--> statement-breakpoint
CREATE INDEX "audit_log_action_at_index" ON "audit_log" USING btree ("action","at");--> statement-breakpoint
CREATE INDEX "availability_slots_accountant_id_starts_at_index" ON "availability_slots" USING btree ("accountant_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "client_tax_profiles_client_id_year_index" ON "client_tax_profiles" USING btree ("client_id","year");--> statement-breakpoint
CREATE INDEX "clients_accountant_id_index" ON "clients" USING btree ("accountant_id");--> statement-breakpoint
CREATE INDEX "clients_adoazonosito_hmac_index" ON "clients" USING btree ("adoazonosito_hmac");--> statement-breakpoint
CREATE INDEX "consents_user_id_index" ON "consents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "deadlines_client_id_due_date_index" ON "deadlines" USING btree ("client_id","due_date");--> statement-breakpoint
CREATE INDEX "document_status_history_document_id_index" ON "document_status_history" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "document_versions_document_id_version_no_index" ON "document_versions" USING btree ("document_id","version_no");--> statement-breakpoint
CREATE INDEX "documents_client_id_dossier_month_index" ON "documents" USING btree ("client_id","dossier_month");--> statement-breakpoint
CREATE UNIQUE INDEX "dossiers_client_id_month_index" ON "dossiers" USING btree ("client_id","month");--> statement-breakpoint
CREATE INDEX "email_codes_email_purpose_index" ON "email_codes" USING btree ("email","purpose");--> statement-breakpoint
CREATE INDEX "files_owner_client_id_index" ON "files" USING btree ("owner_client_id");--> statement-breakpoint
CREATE INDEX "kyc_records_client_id_index" ON "kyc_records" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_documents_doc_type_version_index" ON "legal_documents" USING btree ("doc_type","version");--> statement-breakpoint
CREATE INDEX "messages_client_id_created_at_index" ON "messages" USING btree ("client_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "nav_invoices_client_id_invoice_number_mod_key_operation_index" ON "nav_invoices" USING btree ("client_id","invoice_number","mod_key","operation");--> statement-breakpoint
CREATE INDEX "nav_invoices_client_id_dossier_month_index" ON "nav_invoices" USING btree ("client_id","dossier_month");--> statement-breakpoint
CREATE INDEX "nav_sync_runs_client_id_started_at_index" ON "nav_sync_runs" USING btree ("client_id","started_at");--> statement-breakpoint
CREATE INDEX "notifications_user_id_created_at_index" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_tokens_card_registration_id_index" ON "payment_tokens" USING btree ("card_registration_id");--> statement-breakpoint
CREATE INDEX "requests_client_id_status_index" ON "requests" USING btree ("client_id","status");--> statement-breakpoint
CREATE INDEX "revenue_items_client_id_received_on_index" ON "revenue_items" USING btree ("client_id","received_on");--> statement-breakpoint
CREATE UNIQUE INDEX "revenue_items_nav_invoice_uq" ON "revenue_items" USING btree ("nav_invoice_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_index" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_family_id_index" ON "sessions" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "simplepay_transactions_client_id_index" ON "simplepay_transactions" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "simplepay_transactions_status_index" ON "simplepay_transactions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_calculations_tax_period_id_version_index" ON "tax_calculations" USING btree ("tax_period_id","version");--> statement-breakpoint
CREATE INDEX "tax_payment_items_tax_period_id_index" ON "tax_payment_items" USING btree ("tax_period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_periods_client_id_period_key_index" ON "tax_periods" USING btree ("client_id","period_key");