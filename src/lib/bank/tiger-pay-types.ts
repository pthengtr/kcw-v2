export type TigerPayTransaction = {
  tiger_payment_id: number;
  payment_no: string;
  payment_type: string;
  status: string;
  amount: string | number | null;
  total_pay: string | number | null;
  change_amount: string | number | null;
  ref_no_1: string | null;
  ref_no_2: string | null;
  note: string | null;
  remark: string | null;
  shop_code: string | null;
  shop_name: string | null;
  branch_name: string | null;
  tiger_created_at: string | null;
  tiger_updated_at: string | null;
  first_received_at: string;
  last_received_at: string;
  last_event_id: string | null;
  payload: unknown;
};

export type TigerPayWebhookEvent = {
  id: string;
  event_key: string;
  body_sha256: string;
  tiger_payment_id: number;
  payment_no: string | null;
  payment_type: string;
  payment_status: string;
  tiger_updated_at: string | null;
  received_at: string;
  payload: unknown;
  processing_error: string | null;
};

export type TigerPayStatusGroup =
  | "all"
  | "successful"
  | "pending"
  | "cancelled"
  | "other";

export type TigerPayPaymentTypeFilter =
  | "all"
  | "cash"
  | "promptpay"
  | "qr"
  | "other";

export type TigerPaySortField =
  | "last_received_at"
  | "tiger_updated_at"
  | "amount"
  | "total_pay"
  | "payment_no"
  | "status";

export type TigerPayTransactionQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  paymentType?: TigerPayPaymentTypeFilter;
  statusGroup?: TigerPayStatusGroup;
  from?: string;
  to?: string;
  sortBy?: TigerPaySortField;
  sortDir?: "asc" | "desc";
};

export type TigerPaySummary = {
  totalTransactions: number;
  successful: number;
  pending: number;
  cancelled: number;
  totalPaid: number;
};

export const TIGER_PAY_TRANSACTION_COLUMNS = [
  "tiger_payment_id",
  "payment_no",
  "payment_type",
  "status",
  "amount",
  "total_pay",
  "change_amount",
  "ref_no_1",
  "ref_no_2",
  "note",
  "remark",
  "shop_code",
  "shop_name",
  "branch_name",
  "tiger_created_at",
  "tiger_updated_at",
  "first_received_at",
  "last_received_at",
  "last_event_id",
  "payload",
].join(",");

export const TIGER_PAY_LIST_COLUMNS = [
  "tiger_payment_id",
  "payment_no",
  "payment_type",
  "status",
  "amount",
  "total_pay",
  "change_amount",
  "ref_no_1",
  "ref_no_2",
  "note",
  "remark",
  "shop_code",
  "shop_name",
  "branch_name",
  "tiger_created_at",
  "tiger_updated_at",
  "first_received_at",
  "last_received_at",
  "last_event_id",
].join(",");

export const TIGER_PAY_EVENT_COLUMNS = [
  "id",
  "event_key",
  "body_sha256",
  "tiger_payment_id",
  "payment_no",
  "payment_type",
  "payment_status",
  "tiger_updated_at",
  "received_at",
  "payload",
  "processing_error",
].join(",");

export const PENDING_STATUSES = [
  "pending",
  "pendingapproval",
  "change",
] as const;

export const KNOWN_STATUSES = [
  "success",
  "pending",
  "pendingapproval",
  "change",
  "cancel",
] as const;

export const KNOWN_PAYMENT_TYPES = ["cash", "promptpay", "qr"] as const;
