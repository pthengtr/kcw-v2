import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  BiCustomerNameSource,
  BiCustomerOverview,
  BiCustomerRankRow,
} from "./customer-types";
import type { BiSplitRow } from "./sales-types";

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

function asNullableString(value: unknown): string | null {
  if (value == null) return null;
  const s = asString(value).trim();
  return s ? s : null;
}

function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "t" || value === 1) return true;
  return false;
}

function parseSplitRows(value: unknown): BiSplitRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      key: asString(r.key),
      revenue_net: asNumber(r.revenue_net),
      bill_count: asNumber(r.bill_count),
    };
  });
}

function asNameSource(value: unknown): BiCustomerNameSource {
  if (value === "party" || value === "armas" || value === "none") return value;
  return "none";
}

function parseCustomerRows(value: unknown): BiCustomerRankRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    const customer_name = asString(r.customer_name).trim();
    const name_source = asNameSource(r.name_source);
    return {
      acctno: asString(r.acctno),
      customer_name,
      name_source:
        customer_name && name_source === "none"
          ? // Legacy payloads without name_source still carry a display name.
            asBoolean(r.in_party)
            ? "party"
            : "none"
          : name_source,
      bill_acctname: asNullableString(r.bill_acctname),
      in_party: asBoolean(r.in_party),
      in_armas: asBoolean(r.in_armas),
      party_kind: asNullableString(r.party_kind),
      revenue_net: asNumber(r.revenue_net),
      bill_count: asNumber(r.bill_count),
      avg_bill: asNumber(r.avg_bill),
      hq_revenue_net: asNumber(r.hq_revenue_net),
      syp_revenue_net: asNumber(r.syp_revenue_net),
      online_revenue_net: asNumber(r.online_revenue_net),
    };
  });
}

export function normalizeCustomerOverview(raw: unknown): BiCustomerOverview {
  const data = (raw ?? {}) as Record<string, unknown>;
  const summary = (data.summary ?? {}) as Record<string, unknown>;
  const walkin = (data.walkin_summary ?? {}) as Record<string, unknown>;
  const previous = (data.previous_summary ?? {}) as Record<string, unknown>;

  return {
    from: asString(data.from),
    to: asString(data.to),
    branch: data.branch == null ? null : asString(data.branch),
    limit: asNumber(data.limit) || 50,
    previous_from: asString(data.previous_from),
    previous_to: asString(data.previous_to),
    summary: {
      revenue_net: asNumber(summary.revenue_net),
      customer_count: asNumber(summary.customer_count),
      bill_count: asNumber(summary.bill_count),
      avg_bill: asNumber(summary.avg_bill),
      matched_customer_count: asNumber(summary.matched_customer_count),
      unmatched_customer_count: asNumber(summary.unmatched_customer_count),
    },
    walkin_summary: {
      revenue_net: asNumber(walkin.revenue_net),
      bill_count: asNumber(walkin.bill_count),
    },
    previous_summary: {
      revenue_net: asNumber(previous.revenue_net),
      customer_count: asNumber(previous.customer_count),
      bill_count: asNumber(previous.bill_count),
    },
    by_branch: parseSplitRows(data.by_branch),
    top_customers: parseCustomerRows(data.top_customers),
    unmatched_customers: parseCustomerRows(data.unmatched_customers),
  };
}

export async function fetchCustomerOverview(
  supabase: SupabaseClient,
  params: {
    from: string;
    to: string;
    branch?: string | null;
    limit?: number;
  }
): Promise<BiCustomerOverview> {
  const { data, error } = await supabase.rpc("fn_bi_customer_overview", {
    p_from: params.from,
    p_to: params.to,
    p_branch: params.branch ?? null,
    p_limit: params.limit ?? 50,
  });

  if (error) {
    throw new Error(error.message || "Unable to load customer overview");
  }

  return normalizeCustomerOverview(data);
}
