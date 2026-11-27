-- auto_v3 fingerprints: when balance_after is present, identity is the ledger
-- position (account/date/amount/direction/balance) only. Overlapping KBANK/KTB
-- cumulative exports truncate รายละเอียด differently (++ vs +, cut length), so
-- hashing detail produced false-unique fingerprints and ~278 duplicate rows.
--
-- Mirrors supabase/functions/import-bank-statement/fingerprint.ts (auto_v3).

-- 1) Canonical identity builder (omit detail/ref when balance_after is present)
CREATE OR REPLACE FUNCTION bank.fp_build_input(
  p_account_no text,
  p_txn_date date,
  p_direction text,
  p_amount numeric,
  p_balance_after numeric,
  p_bank_reference text,
  p_raw jsonb
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT concat_ws(
    '|',
    bank.fp_norm_text(p_account_no),
    p_txn_date::text,
    bank.fp_norm_money(p_amount),
    bank.fp_norm_text(p_direction),
    CASE
      WHEN p_balance_after IS NULL THEN
        bank.fp_norm_text(bank.fp_transaction_detail(p_raw))
      ELSE ''
    END,
    CASE
      WHEN p_balance_after IS NULL THEN
        bank.fp_norm_text(coalesce(p_bank_reference, ''))
      ELSE ''
    END,
    bank.fp_norm_money(p_balance_after)
  );
$$;

CREATE OR REPLACE FUNCTION bank.fp_build_hash(
  p_account_no text,
  p_txn_date date,
  p_direction text,
  p_amount numeric,
  p_balance_after numeric,
  p_bank_reference text,
  p_raw jsonb
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT encode(
    digest(
      bank.fp_build_input(
        p_account_no, p_txn_date, p_direction, p_amount,
        p_balance_after, p_bank_reference, p_raw
      ),
      'sha256'
    ),
    'hex'
  );
$$;

-- 2) Drop newer duplicate copies; keep the best-matched / oldest canonical row.
WITH ranked AS (
  SELECT
    sl.id,
    row_number() OVER (
      PARTITION BY sl.account_no, sl.txn_date, sl.direction, sl.amount, sl.balance_after
      ORDER BY
        CASE
          WHEN sl.match_status IN ('matched', 'resolved', 'manual') THEN 0
          WHEN sl.match_status = 'review'
               AND coalesce(sl.matched_ref_type, '') <> 'possible_duplicate'
               AND sl.matched_ref_id IS NOT NULL
               AND sl.matched_ref_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            THEN 1
          WHEN sl.match_status IN ('review', 'unmatched', 'pending')
               AND coalesce(sl.matched_ref_type, '') <> 'possible_duplicate'
            THEN 2
          WHEN coalesce(sl.matched_ref_type, '') = 'possible_duplicate' THEN 4
          WHEN sl.match_status = 'ignored' THEN 5
          ELSE 3
        END,
        sl.created_at ASC,
        sl.id ASC
    ) AS keep_rank
  FROM bank.statement_lines sl
  WHERE sl.balance_after IS NOT NULL
)
DELETE FROM bank.statement_lines sl
WHERE sl.id IN (SELECT id FROM ranked WHERE keep_rank > 1);

-- 3) Recompute all fingerprints to auto_v3 (two-phase avoids unique collisions).
UPDATE bank.statement_lines sl
SET transaction_fingerprint = 'tmp-v3-recompute-' || sl.id::text
WHERE sl.transaction_fingerprint IS DISTINCT FROM bank.fp_build_hash(
  sl.account_no,
  sl.txn_date,
  sl.direction,
  sl.amount,
  sl.balance_after,
  sl.bank_reference,
  sl.raw_json
);

UPDATE bank.statement_lines sl
SET transaction_fingerprint = bank.fp_build_hash(
  sl.account_no,
  sl.txn_date,
  sl.direction,
  sl.amount,
  sl.balance_after,
  sl.bank_reference,
  sl.raw_json
)
WHERE sl.transaction_fingerprint LIKE 'tmp-v3-recompute-%';

-- 4) Hard DB guard: same ledger position cannot be inserted twice.
CREATE UNIQUE INDEX IF NOT EXISTS statement_lines_ledger_uidx
  ON bank.statement_lines (account_no, txn_date, direction, amount, balance_after)
  WHERE balance_after IS NOT NULL;

-- 5) Align import-file counters with remaining lines.
UPDATE bank.statement_import_files f
SET inserted_count = sub.line_count,
    duplicate_count = GREATEST(0, coalesce(f.row_count, 0) - sub.line_count)
FROM (
  SELECT source_file_id, count(*)::int AS line_count
  FROM bank.statement_lines
  WHERE source_file_id IS NOT NULL
  GROUP BY source_file_id
) sub
WHERE f.id = sub.source_file_id
  AND f.status = 'imported';
