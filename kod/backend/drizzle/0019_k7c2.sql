-- k7c2 fix round (2026-11-20): payments safety. ADDITIVE ONLY (new nullable columns, one partial unique index).
-- up.sh makes the encrypted pg_dump before this runs. No existing row is changed.
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "charge_params" jsonb;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "refund_pending_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "predebit_period" date;
--> statement-breakpoint
ALTER TABLE "stripe_events" ADD COLUMN IF NOT EXISTS "claimed_at" timestamp with time zone;
--> statement-breakpoint
-- At most one successful payment per one-off fee. Created only when the data has no duplicate yet (the live DEMO had 0 on
-- 2026-11-20); otherwise the code-level check still holds and the index waits for the admin to sort the duplicates out.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "payments"
    WHERE "kind" = 'egyszeri' AND "status" = 'sikeres' AND "fee_charge_id" IS NOT NULL
    GROUP BY "fee_charge_id" HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "payments_one_success_per_fee" ON "payments" ("fee_charge_id")
      WHERE kind = 'egyszeri' and status = 'sikeres' and fee_charge_id is not null;
  ELSE
    RAISE NOTICE 'payments_one_success_per_fee not created: duplicate successful fee payments exist';
  END IF;
END $$;
