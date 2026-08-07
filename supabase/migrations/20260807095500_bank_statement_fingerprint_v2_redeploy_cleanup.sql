-- Follow-up cleanup after overlapping monthly/cumulative imports inserted 120
-- duplicate statement_lines while the live Edge Function was still auto_v1
-- (description-based fingerprints). Repo had auto_v2, but production imports
-- after the first fingerprint migration still hashed display description, so
-- they did not collide with recomputed v2 fingerprints on older rows.
--
-- Operator already removed the newer pending copies and corrected import
-- metadata; this migration is idempotent and also recomputes any remaining
-- non-v2 fingerprints (Jan–Mar monthly files + Aug cumulative uploads).

-- 1) Remove newer duplicate copies for the known overlapping imports
--    (keep older canonical rows). Safe no-op if already cleaned.
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
   AND b.balance_after IS NOT DISTINCT FROM a.balance_after
   AND b.id <> a.id
   AND a.created_at > b.created_at
  JOIN bank.statement_import_files f_old ON f_old.id = b.source_file_id
  WHERE (
      f_new.original_filename = '3557 ด.4.xlsx'
      AND f_old.original_filename = '04_3557.xlsx'
    )
    OR (
      f_new.original_filename = 'KBANK7236.xlsx'
      AND f_new.first_seen_at >= '2026-08-07 00:00:00+00'
      AND f_old.original_filename <> 'KBANK7236.xlsx'
      AND coalesce(bank.fp_norm_text(bank.fp_transaction_detail(a.raw_json)), '')
        = coalesce(bank.fp_norm_text(bank.fp_transaction_detail(b.raw_json)), '')
    )
    OR (
      f_new.original_filename = 'KBANK0393.xlsx'
      AND f_new.first_seen_at >= '2026-08-07 00:00:00+00'
      AND f_old.original_filename <> 'KBANK0393.xlsx'
      AND coalesce(bank.fp_norm_text(bank.fp_transaction_detail(a.raw_json)), '')
        = coalesce(bank.fp_norm_text(bank.fp_transaction_detail(b.raw_json)), '')
    )
    OR (
      f_new.original_filename = 'KBANK4759.xlsx'
      AND f_new.first_seen_at >= '2026-08-07 00:00:00+00'
      AND f_old.original_filename <> 'KBANK4759.xlsx'
      AND coalesce(bank.fp_norm_text(bank.fp_transaction_detail(a.raw_json)), '')
        = coalesce(bank.fp_norm_text(bank.fp_transaction_detail(b.raw_json)), '')
    )
);

-- 2) Align import metadata with actual inserts vs duplicates.
UPDATE bank.statement_import_files
SET inserted_count = 0,
    duplicate_count = 114
WHERE original_filename = '3557 ด.4.xlsx';

UPDATE bank.statement_import_files
SET inserted_count = 15,
    duplicate_count = 4
WHERE original_filename = 'KBANK7236.xlsx'
  AND first_seen_at >= '2026-08-07 00:00:00+00'
  AND row_count = 19;

UPDATE bank.statement_import_files
SET inserted_count = 7,
    duplicate_count = 1
WHERE original_filename = 'KBANK0393.xlsx'
  AND first_seen_at >= '2026-08-07 00:00:00+00'
  AND row_count = 8;

UPDATE bank.statement_import_files
SET inserted_count = 6,
    duplicate_count = 1
WHERE original_filename = 'KBANK4759.xlsx'
  AND first_seen_at >= '2026-08-07 00:00:00+00'
  AND row_count = 7;

-- 3) Recompute remaining auto_v1 fingerprints to canonical auto_v2 identity.
--    Two-phase update avoids transient unique collisions while rewriting hashes.
UPDATE bank.statement_lines sl
SET transaction_fingerprint = 'tmp-v2-recompute-' || sl.id::text
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
WHERE sl.transaction_fingerprint LIKE 'tmp-v2-recompute-%';
