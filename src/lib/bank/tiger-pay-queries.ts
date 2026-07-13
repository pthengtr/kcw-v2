import type { SupabaseClient } from "@supabase/supabase-js";

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
