-- SPEC §31 (marketing, 2026-11-20): where registrations and callback requests came from, the (switched-off) ad consent
-- records and conversion outbox, and the owner's typed-in ad spend. ADDITIVE ONLY: new tables and one INSERT that fills
-- the new table from signup_attribution; no existing row or column is changed. up.sh makes the encrypted pg_dump before
-- this runs. Uses no enum value added by 0020.

CREATE TABLE IF NOT EXISTS "marketing_touches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "kind" text NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "client_id" uuid REFERENCES "clients"("id"),
  "callback_request_id" uuid,
  "channel" text NOT NULL,
  "utm_source" text,
  "utm_medium" text,
  "utm_campaign" text,
  "utm_content" text,
  "utm_term" text,
  "referrer_domain" text,
  "landing_path" text,
  "platform" text,
  "entry_source" text,
  "entry_goal" text,
  "inherited" boolean DEFAULT false NOT NULL,
  "before_tracking" boolean DEFAULT false NOT NULL,
  "click_ids" jsonb,
  "consent_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "marketing_touches_kind_chk" CHECK ("kind" in ('regisztracio', 'visszahivas')),
  CONSTRAINT "marketing_touches_channel_chk" CHECK ("channel" in ('youtube', 'google', 'facebook', 'instagram', 'tiktok', 'kozvetlen', 'egyeb'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketing_touches_user_kind_idx" ON "marketing_touches" ("user_id", "kind");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketing_touches_created_idx" ON "marketing_touches" ("created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "marketing_consents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid REFERENCES "users"("id"),
  "meta" boolean DEFAULT false NOT NULL,
  "google" boolean DEFAULT false NOT NULL,
  "personalization" boolean DEFAULT false NOT NULL,
  "notice_version" text NOT NULL,
  "source" text NOT NULL,
  "ip_hmac" text,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "linked_at" timestamp with time zone,
  "withdrawn_at" timestamp with time zone,
  CONSTRAINT "marketing_consents_source_chk" CHECK ("source" in ('landing', 'app'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketing_consents_user_idx" ON "marketing_consents" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ad_conversion_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" text NOT NULL,
  "event" text NOT NULL,
  "event_id" text NOT NULL,
  "user_id" uuid NOT NULL,
  "consent_id" uuid NOT NULL,
  "event_time" timestamp with time zone NOT NULL,
  "payload" jsonb NOT NULL,
  "status" text DEFAULT 'var' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_error" text,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ad_conversion_events_provider_chk" CHECK ("provider" in ('meta', 'google')),
  CONSTRAINT "ad_conversion_events_event_chk" CHECK ("event" in ('regisztracio', 'fizetes')),
  CONSTRAINT "ad_conversion_events_status_chk" CHECK ("status" in ('var', 'elkuldve', 'hiba', 'elvetve'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ad_conversion_events_provider_event_uq" ON "ad_conversion_events" ("provider", "event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ad_conversion_events_status_idx" ON "ad_conversion_events" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ad_spend" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "day" date NOT NULL,
  "platform" text NOT NULL,
  "campaign" text,
  "amount_huf" integer NOT NULL,
  "note" text,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone,
  "revoked_by" uuid,
  CONSTRAINT "ad_spend_platform_chk" CHECK ("platform" in ('meta', 'google', 'egyeb')),
  CONSTRAINT "ad_spend_amount_chk" CHECK ("amount_huf" > 0 and "amount_huf" <= 100000000)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ad_spend_day_idx" ON "ad_spend" ("day");
--> statement-breakpoint
-- The registrations before this release get their row from signup_attribution (channel from utm_source by the rule of
-- shared/src/marketing.ts channelOf; no referrer was ever stored, so "kozvetlen" without a source). Only accounts that
-- have no row yet; nothing existing is changed. before_tracking = true: the Marketing tab shows these without a campaign
-- link as "Ismeretlen (a mérés előtt)", not as "Közvetlen".
INSERT INTO "marketing_touches" ("kind", "user_id", "client_id", "channel", "utm_source", "utm_medium", "utm_campaign", "utm_content", "platform", "before_tracking", "created_at")
SELECT 'regisztracio', sa."user_id", cl."id",
  CASE
    WHEN coalesce(btrim(sa."utm_source"), '') = '' THEN 'kozvetlen'
    WHEN lower(btrim(sa."utm_source")) IN ('youtube', 'yt', 'youtube-video') OR lower(btrim(sa."utm_source")) ~ '(^|\.)(youtube\.com|youtu\.be)$' THEN 'youtube'
    WHEN lower(btrim(sa."utm_source")) IN ('google', 'googleads', 'google-ads', 'adwords', 'gads') OR lower(btrim(sa."utm_source")) ~ '(^|\.)google\.[a-z]{2,3}(\.[a-z]{2})?$' THEN 'google'
    WHEN lower(btrim(sa."utm_source")) IN ('facebook', 'fb', 'meta', 'messenger') OR lower(btrim(sa."utm_source")) ~ '(^|\.)(facebook\.com|messenger\.com)$' THEN 'facebook'
    WHEN lower(btrim(sa."utm_source")) IN ('instagram', 'ig') OR lower(btrim(sa."utm_source")) ~ '(^|\.)instagram\.com$' THEN 'instagram'
    WHEN lower(btrim(sa."utm_source")) IN ('tiktok', 'tt') OR lower(btrim(sa."utm_source")) ~ '(^|\.)tiktok\.com$' THEN 'tiktok'
    WHEN lower(btrim(sa."utm_source")) IN ('direct', 'kozvetlen') THEN 'kozvetlen'
    ELSE 'egyeb'
  END,
  sa."utm_source", sa."utm_medium", sa."utm_campaign", sa."utm_content",
  CASE WHEN sa."landing" IN ('web', 'android', 'ios') THEN sa."landing" ELSE NULL END,
  true,
  sa."first_seen_at"
FROM "signup_attribution" sa
LEFT JOIN "clients" cl ON cl."user_id" = sa."user_id"
WHERE NOT EXISTS (SELECT 1 FROM "marketing_touches" mt WHERE mt."user_id" = sa."user_id" AND mt."kind" = 'regisztracio');
