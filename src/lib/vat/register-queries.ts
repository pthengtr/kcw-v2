import type { SupabaseClient } from "@supabase/supabase-js";

import type { VatPaidStatus, VatRegisterRow, VatRegisterSide } from "./register";

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

function asNullable(value: unknown): string | null {
  const text = asString(value).trim();
  return text === "" ? null : text;
}

type Evidence = {
  line_key: string;
  paid_status: string;
  paid_on: string | null;
  note: string | null;
};

async function fetchAllRegisterRows(
  supabase: SupabaseClient,
  monthStart: string,
  branch: string | null,
  side: VatRegisterSide | null
): Promise<Record<string, unknown>[]> {
  const pageSize = 1000;
  const rows: Record<string, unknown>[] = [];
  let from = 0;

  for (;;) {
    let query = supabase
      .schema("curated_kcw")
      .from("vw_vat_register")
      .select(
        "line_key, report_month, branch, side, sheet, source, source_ref, bill_date, bill_no, display_bill_no, party_name, tax_id, before_vat, vat, after_vat, detail, remark"
      )
      .eq("report_month", monthStart)
      .order("bill_date", { ascending: true })
      .order("bill_no", { ascending: true })
      .range(from, from + pageSize - 1);

    if (branch) query = query.eq("branch", branch);
    if (side) query = query.eq("side", side);

    const { data, error } = await query;
    if (error) throw error;
    const page = (data ?? []) as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
    if (from > 20000) break;
  }

  return rows;
}

async function fetchEvidence(
  supabase: SupabaseClient,
  lineKeys: string[]
): Promise<Map<string, Evidence>> {
  const map = new Map<string, Evidence>();
  const chunk = 200;
  for (let i = 0; i < lineKeys.length; i += chunk) {
    const keys = lineKeys.slice(i, i + chunk);
    const { data, error } = await supabase
      .schema("ops")
      .from("vat_line_evidence")
      .select("line_key, paid_status, paid_on, note")
      .in("line_key", keys);
    if (error) throw error;
    for (const row of data ?? []) {
      const record = row as Evidence;
      map.set(record.line_key, record);
    }
  }
  return map;
}

async function fetchFileCounts(
  supabase: SupabaseClient,
  lineKeys: string[]
): Promise<Map<string, { invoice: number; receipt: number }>> {
  const map = new Map<string, { invoice: number; receipt: number }>();
  const chunk = 200;
  for (let i = 0; i < lineKeys.length; i += chunk) {
    const keys = lineKeys.slice(i, i + chunk);
    const { data, error } = await supabase
      .schema("ops")
      .from("vat_line_files")
      .select("line_key, kind")
      .in("line_key", keys);
    if (error) throw error;
    for (const row of data ?? []) {
      const lineKey = asString((row as { line_key: string }).line_key);
      const kind = asString((row as { kind: string }).kind);
      const current = map.get(lineKey) ?? { invoice: 0, receipt: 0 };
      if (kind === "invoice") current.invoice += 1;
      if (kind === "receipt") current.receipt += 1;
      map.set(lineKey, current);
    }
  }
  return map;
}

export async function fetchVatRegister(
  supabase: SupabaseClient,
  input: {
    monthStart: string;
    branch: string | null;
    side: VatRegisterSide | null;
  }
): Promise<VatRegisterRow[]> {
  const raw = await fetchAllRegisterRows(
    supabase,
    input.monthStart,
    input.branch,
    input.side
  );
  const lineKeys = raw.map((row) => asString(row.line_key)).filter(Boolean);
  const [evidence, counts] = await Promise.all([
    fetchEvidence(supabase, lineKeys),
    fetchFileCounts(supabase, lineKeys),
  ]);

  return raw.map((row) => {
    const lineKey = asString(row.line_key);
    const paid = evidence.get(lineKey);
    const files = counts.get(lineKey);
    const status: VatPaidStatus =
      paid?.paid_status === "paid" ? "paid" : "unpaid";
    return {
      line_key: lineKey,
      report_month: asString(row.report_month).slice(0, 10),
      branch: asString(row.branch),
      side: asString(row.side) === "purchase" ? "purchase" : "sales",
      sheet: asString(row.sheet),
      source: asString(row.source),
      source_ref: asNullable(row.source_ref),
      bill_date: asString(row.bill_date).slice(0, 10),
      bill_no: asString(row.bill_no),
      display_bill_no: asString(row.display_bill_no),
      party_name: asNullable(row.party_name),
      tax_id: asNullable(row.tax_id),
      before_vat: asNumber(row.before_vat),
      vat: asNumber(row.vat),
      after_vat: asNumber(row.after_vat),
      detail: asNullable(row.detail),
      remark: asNullable(row.remark),
      paid_status: status,
      paid_on: paid?.paid_on ? asString(paid.paid_on).slice(0, 10) : null,
      note: asNullable(paid?.note),
      invoice_count: files?.invoice ?? 0,
      receipt_count: files?.receipt ?? 0,
    };
  });
}

export async function findVatRegisterLine(
  supabase: SupabaseClient,
  lineKey: string
): Promise<{
  line_key: string;
  branch: string;
  side: string;
  sheet: string;
  bill_no: string;
  bill_date: string;
  source_ref: string | null;
} | null> {
  const { data, error } = await supabase
    .schema("curated_kcw")
    .from("vw_vat_register")
    .select("line_key, branch, side, sheet, bill_no, bill_date, source_ref")
    .eq("line_key", lineKey)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    line_key: asString(row.line_key),
    branch: asString(row.branch),
    side: asString(row.side),
    sheet: asString(row.sheet),
    bill_no: asString(row.bill_no),
    bill_date: asString(row.bill_date).slice(0, 10),
    source_ref: asNullable(row.source_ref),
  };
}
