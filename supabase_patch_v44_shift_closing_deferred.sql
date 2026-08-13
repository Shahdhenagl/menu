-- v44: Persist deferred (credit) totals for each shift closing.
-- Deferred is informational and must never be included in collected or expected_balance.

ALTER TABLE public.shift_closings
  ADD COLUMN IF NOT EXISTS deferred NUMERIC NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.shift_closings.deferred IS
  'Deferred/credit amount for this drawer and shift; excluded from collected and expected_balance';

NOTIFY pgrst, 'reload schema';

-- Verification:
-- SELECT id, bucket, collected, deferred, expected_balance
-- FROM public.shift_closings
-- ORDER BY to_at DESC
-- LIMIT 20;

-- If the table is created by an older migration in a fresh database, this is
-- intentionally safe because ADD COLUMN IF NOT EXISTS can be run repeatedly.
