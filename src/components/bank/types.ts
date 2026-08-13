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
  match_reason: string | null;
  match_confidence: number | null;
  matched_ref_type: string | null;
  matched_ref_id: string | null;
  match_notes: string | null;
  report_remark: string | null;
  matched_at: string | null;
  matched_by: string | null;
  source_sheet_name: string | null;
  source_row_number: number | null;
  source_file_id: string | null;
};

export type {
  TigerPayTransaction,
  TigerPayWebhookEvent,
  TigerPayStatusGroup,
  TigerPayPaymentTypeFilter,
  TigerPaySummary,
} from "@/lib/bank/tiger-pay-types";

