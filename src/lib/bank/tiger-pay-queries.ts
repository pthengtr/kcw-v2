import type { SupabaseClient } from "@supabase/supabase-js";

import {
  mapCashSnapshot,
  mapDailyClose,
  type TigerPayCashSnapshot,
  type TigerPayDailyClose,
} from "@/lib/bank/tiger-pay-daily";
import { isNumericSearch } from "@/lib/bank/tiger-pay-format";
import {
  KNOWN_PAYMENT_TYPES,
  KNOWN_STATUSES,
  PENDING_STATUSES,
  TIGER_PAY_EVENT_COLUMNS,
  TIGER_PAY_LIST_COLUMNS,
  TIGER_PAY_TRANSACTION_COLUMNS,
  type TigerPaySortField,
  type TigerPayStatusGroup,
  type TigerPaySummary,
  type TigerPayTransaction,
  type TigerPayTransactionQuery,
  type TigerPayWebhookEvent,
} from "@/lib/bank/tiger-pay-types";

type QueryResult<T> = {
  rows: T[];
  count: number | null;
  page: number;
  pageSize: number;
};

type ListRow = Omit<TigerPayTransaction, "payload">;

const SORTABLE = new Set<TigerPaySortField>([
  "last_received_at",
  "tiger_updated_at",
  "amount",
  "total_pay",
  "payment_no",
  "status",
]);

function tigerPay(supabase: SupabaseClient) {
  return supabase.schema("tiger_pay");
}

// Supabase PostgrestFilterBuilder is loosely typed across custom schemas.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildTransactionFilters(query: any, input: Pick<
    TigerPayTransactionQuery,
    "search" | "paymentType" | "statusGroup" | "from" | "to"
  >) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let next: any = query;

  const term = input.search?.trim();
  if (term) {
    const escaped = term.replace(/,/g, " ");
    const pattern = `%${escaped}%`;
    const parts = [
      `payment_no.ilike.${pattern}`,
      `shop_code.ilike.${pattern}`,
      `shop_name.ilike.${pattern}`,
      `branch_name.ilike.${pattern}`,
      `ref_no_1.ilike.${pattern}`,
      `ref_no_2.ilike.${pattern}`,
    ];
    if (isNumericSearch(term)) {
      parts.push(`tiger_payment_id.eq.${term}`);
    }
    next = next.or(parts.join(","));
  }

  const paymentType = input.paymentType ?? "all";
  if (paymentType === "other") {
    next = next.not(
      "payment_type",
      "in",
      `(${KNOWN_PAYMENT_TYPES.join(",")})`
    );
  } else if (paymentType !== "all") {
    next = next.eq("payment_type", paymentType);
  }

  const statusGroup = input.statusGroup ?? "all";
  if (statusGroup === "successful") {
    next = next.eq("status", "success");
  } else if (statusGroup === "pending") {
    next = next.in("status", [...PENDING_STATUSES]);
  } else if (statusGroup === "cancelled") {
    next = next.eq("status", "cancel");
  } else if (statusGroup === "other") {
    next = next.not("status", "in", `(${KNOWN_STATUSES.join(",")})`);
  }

  if (input.from) next = next.gte("last_received_at", input.from);
  if (input.to) next = next.lte("last_received_at", input.to);

  return next;
}

export async function getTigerPayTransactions(
  supabase: SupabaseClient,
  input: TigerPayTransactionQuery = {}
): Promise<QueryResult<ListRow>> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, input.pageSize ?? 50));
  const offset = (page - 1) * pageSize;
  const sortBy = SORTABLE.has(input.sortBy as TigerPaySortField)
    ? (input.sortBy as TigerPaySortField)
    : "last_received_at";
  const ascending = input.sortDir === "asc";

  const filtered = buildTransactionFilters(
    tigerPay(supabase)
      .from("payment_transaction")
      .select(TIGER_PAY_LIST_COLUMNS, { count: "exact" }),
    input
  );

  const { data, error, count } = await filtered
    .order(sortBy, { ascending })
    .range(offset, offset + pageSize - 1);

  if (error) {
    throw new Error(error.message);
  }

  return {
    rows: ((data ?? []) as unknown) as ListRow[],
    count: count ?? null,
    page,
    pageSize,
  };
}

export async function getTigerPayTransactionById(
  supabase: SupabaseClient,
  tigerPaymentId: number
): Promise<TigerPayTransaction | null> {
  const { data, error } = await tigerPay(supabase)
    .from("payment_transaction")
    .select(TIGER_PAY_TRANSACTION_COLUMNS)
    .eq("tiger_payment_id", tigerPaymentId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return ((data as unknown) as TigerPayTransaction | null) ?? null;
}

export async function getTigerPayWebhookEvents(
  supabase: SupabaseClient,
  tigerPaymentId: number
): Promise<TigerPayWebhookEvent[]> {
  const { data, error } = await tigerPay(supabase)
    .from("webhook_event")
    .select(TIGER_PAY_EVENT_COLUMNS)
    .eq("tiger_payment_id", tigerPaymentId)
    .order("received_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown) as TigerPayWebhookEvent[];
}

async function countWithStatus(
  supabase: SupabaseClient,
  input: Omit<
    TigerPayTransactionQuery,
    "page" | "pageSize" | "sortBy" | "sortDir" | "statusGroup"
  >,
  statusGroup: TigerPayStatusGroup
): Promise<number> {
  const filtered = buildTransactionFilters(
    tigerPay(supabase)
      .from("payment_transaction")
      .select("tiger_payment_id", { count: "exact", head: true }),
    { ...input, statusGroup }
  );
  const { count, error } = await filtered;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getTigerPaySummary(
  supabase: SupabaseClient,
  input: Omit<
    TigerPayTransactionQuery,
    "page" | "pageSize" | "sortBy" | "sortDir"
  > = {}
): Promise<TigerPaySummary> {
  const filterInput = {
    search: input.search,
    paymentType: input.paymentType,
    from: input.from,
    to: input.to,
  };

  const [totalTransactions, successful, pending, cancelled] = await Promise.all(
    [
      countWithStatus(supabase, filterInput, input.statusGroup ?? "all"),
      countWithStatus(supabase, filterInput, "successful"),
      countWithStatus(supabase, filterInput, "pending"),
      countWithStatus(supabase, filterInput, "cancelled"),
    ]
  );

  // Sum total_pay only for successful rows that still match active filters.
  const paidQuery = buildTransactionFilters(
    tigerPay(supabase)
      .from("payment_transaction")
      .select("total_pay"),
    { ...filterInput, statusGroup: "successful" }
  );
  const { data, error } = await paidQuery;
  if (error) throw new Error(error.message);

  let totalPaid = 0;
  for (const row of data ?? []) {
    const paid = Number((row as { total_pay: string | number | null }).total_pay);
    if (Number.isFinite(paid)) totalPaid += paid;
  }

  return {
    totalTransactions,
    successful,
    pending,
    cancelled,
    totalPaid,
  };
}

export async function getTigerPayTransactionsForWindow(
  supabase: SupabaseClient,
  input: { fromIso: string; toIso: string; shopCode?: string }
): Promise<TigerPayTransaction[]> {
  let query = tigerPay(supabase)
    .from("payment_transaction")
    .select(TIGER_PAY_TRANSACTION_COLUMNS)
    .gte("last_received_at", input.fromIso)
    .lt("last_received_at", input.toIso)
    .order("last_received_at", { ascending: true })
    .limit(2000);

  if (input.shopCode) {
    query = query.eq("shop_code", input.shopCode);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown) as TigerPayTransaction[];
}

export async function getTigerPayAttemptsForWindow(
  supabase: SupabaseClient,
  input: { fromIso: string; toIso: string }
): Promise<
  Array<{
    tiger_payment_id: number | null;
    pos_bill_number: string | null;
    submitted_by_name: string | null;
    created_at: string | null;
  }>
> {
  const { data, error } = await tigerPay(supabase)
    .from("payment_attempt")
    .select("tiger_payment_id,pos_bill_number,submitted_by_name,created_at")
    .gte("created_at", input.fromIso)
    .lt("created_at", input.toIso)
    .limit(2000);
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{
    tiger_payment_id: number | null;
    pos_bill_number: string | null;
    submitted_by_name: string | null;
    created_at: string | null;
  }>;
}

export async function getTigerPayVouchersForWindow(
  supabase: SupabaseClient,
  input: { fromIso: string; toIso: string }
): Promise<
  Array<{
    id: string | null;
    pos_bill_number: string | null;
    voucher_num: string | null;
    amount: number | string | null;
    status: string | null;
    submitted_by_name: string | null;
    created_at: string | null;
    updated_at: string | null;
  }>
> {
  const { data, error } = await tigerPay(supabase)
    .from("voucher_attempt")
    .select(
      "id,pos_bill_number,voucher_num,amount,status,submitted_by_name,created_at,updated_at"
    )
    .gte("created_at", input.fromIso)
    .lt("created_at", input.toIso)
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{
    id: string | null;
    pos_bill_number: string | null;
    voucher_num: string | null;
    amount: number | string | null;
    status: string | null;
    submitted_by_name: string | null;
    created_at: string | null;
    updated_at: string | null;
  }>;
}

export async function getLatestCashSnapshot(
  supabase: SupabaseClient,
  shopCode: string
): Promise<TigerPayCashSnapshot | null> {
  const { data, error } = await tigerPay(supabase)
    .from("cash_snapshot")
    .select(
      "id,captured_at,biz_day,trigger,change_ready,change_level,change_reasons,items,total_baht,shop_code"
    )
    .eq("shop_code", shopCode)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return mapCashSnapshot(data);
}

export async function getDailyClose(
  supabase: SupabaseClient,
  input: { date: string; shopCode: string }
): Promise<TigerPayDailyClose | null> {
  const { data, error } = await tigerPay(supabase)
    .from("daily_close")
    .select(
      "biz_day,shop_code,closed_at,trigger,opening_snapshot_id,closing_snapshot_id,report,locked"
    )
    .eq("biz_day", input.date)
    .eq("shop_code", input.shopCode)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return mapDailyClose(data);
}

export async function insertCashCommand(
  supabase: SupabaseClient,
  input: {
    command: "refresh" | "close";
    shopCode: string;
    date?: string;
    requestedBy?: string | null;
  }
) {
  const { data, error } = await tigerPay(supabase)
    .from("cash_command")
    .insert({
      command: input.command,
      shop_code: input.shopCode,
      biz_day: input.date ?? null,
      requested_by: input.requestedBy ?? null,
    })
    .select("id,command,status,requested_at,error,snapshot_id")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getCashCommand(
  supabase: SupabaseClient,
  id: string
) {
  const { data, error } = await tigerPay(supabase)
    .from("cash_command")
    .select("id,command,status,requested_at,started_at,finished_at,error,snapshot_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
