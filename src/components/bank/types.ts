export type StatementImportFileRow = {
  id: string;
  last_seen_at: string;
  bank_name: string | null;
  account_no: string | null;
  original_filename: string;
  status: string;
  row_count: number;
  inserted_count: number;
  duplicate_count: number;
  error_count: number;
  error_message: string | null;
  raw_metadata: unknown;
};

export type StatementLineRow = {
  id: string;
  txn_date: string;
  created_at: string;
  description: string | null;
  amount: number;
  direction: string;
  balance_after: number | null;
  bank_reference: string | null;
  account_no: string;
  bank_name: string | null;
  match_status: string;
  source_sheet_name: string | null;
  source_row_number: number | null;
  source_file_id: string | null;
};

