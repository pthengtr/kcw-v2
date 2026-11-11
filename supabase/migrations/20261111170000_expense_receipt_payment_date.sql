-- Optional payment/voucher date layer on expense receipts.
-- Bill date remains receipt_date (source). payment_date drives PV when set.
-- Null for skip voucher_type (official company source) and when PV should use bill date.

ALTER TABLE public.expense_receipt
  ADD COLUMN IF NOT EXISTS payment_date date NULL;

COMMENT ON COLUMN public.expense_receipt.payment_date IS
  'Optional payment voucher date; null means use receipt_date (bill date) for PV.';
