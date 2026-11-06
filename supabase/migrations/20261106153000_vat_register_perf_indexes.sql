-- VAT register performance indexes

-- Faster lookups and aggregations on evidence/files used by VAT register JSON

CREATE INDEX IF NOT EXISTS vat_line_files_line_key_uploaded_idx
  ON ops.vat_line_files (line_key, uploaded_at);

-- Helpful when filtering/reporting by accounting month or document month.
CREATE INDEX IF NOT EXISTS vat_line_evidence_doc_month_idx
  ON ops.vat_line_evidence (doc_month);

