-- Bank statement duplicate cleanup (KBANK0393 cumulative May file) and
-- canonical transaction_fingerprint recompute (auto_v2: stable detail, not display description).

-- Normalization helpers mirroring supabase/functions/import-bank-statement/fingerprint.ts
CREATE OR REPLACE FUNCTION bank.fp_norm_text(val text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(trim(upper(coalesce(replace(val, chr(160), ' '), ''))), '\s+', ' ', 'g');
$$;

CREATE OR REPLACE FUNCTION bank.fp_norm_money(val numeric)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN val IS NULL THEN ''
    ELSE trim(to_char(round(val, 2), 'FM999999999990.00'))
  END;
$$;

CREATE OR REPLACE FUNCTION bank.fp_transaction_detail(raw jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(
    nullif(trim(raw->>'รายละเอียด'), ''),
    nullif(trim(raw->>'DESCRIPTION'), ''),
    nullif(trim(raw->>'PARTICULAR'), ''),
    nullif(trim(raw->>'NARRATION'), ''),
    ''
  );
$$;

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
    bank.fp_norm_text(bank.fp_transaction_detail(p_raw)),
    bank.fp_norm_text(coalesce(p_bank_reference, '')),
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

-- 1) Remove newer duplicate rows from KBANK0393_31_5_69.xlsx (keep earlier canonical rows).
DELETE FROM bank.statement_lines sl
WHERE sl.id IN (
  SELECT a.id
  FROM bank.statement_lines a
  JOIN bank.statement_import_files f_new ON f_new.id = a.source_file_id
  JOIN bank.statement_lines b
    ON b.account_no = a.account_no
   AND b.txn_date = a.txn_date
   AND b.direction = a.direction
   AND b.amount = a.amount
   AND b.balance_after = a.balance_after
   AND b.id <> a.id
  JOIN bank.statement_import_files f_old ON f_old.id = b.source_file_id
  WHERE f_new.original_filename = 'KBANK0393_31_5_69.xlsx'
    AND f_old.original_filename <> 'KBANK0393_31_5_69.xlsx'
    AND a.created_at > b.created_at
);

-- 2) Correct import metadata for the cumulative file.
UPDATE bank.statement_import_files
SET inserted_count = 12,
    duplicate_count = 77
WHERE original_filename = 'KBANK0393_31_5_69.xlsx';

-- 3) Recompute transaction fingerprints for all statement lines (canonical identity).
UPDATE bank.statement_lines sl
SET transaction_fingerprint = bank.fp_build_hash(
  sl.account_no,
  sl.txn_date,
  sl.direction,
  sl.amount,
  sl.balance_after,
  sl.bank_reference,
  sl.raw_json
);
