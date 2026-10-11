import type { SupabaseClient } from "@supabase/supabase-js";

import { creditorIdentity } from "@/lib/po/creditor";

import {
  monthEndIso,
  type VatPaidStatus,
  type VatRegisterRow,
  type VatRegisterSide,
} from "./register";

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

export async function fetchVatRegister(
  supabase: SupabaseClient,
  input: {
    monthStart: string;
    branch: string | null;
    side: VatRegisterSide | null;
  }
): Promise<VatRegisterRow[]> {
  const { data, error } = await supabase.rpc("fn_vat_register_json", {
    p_from: input.monthStart,
    p_to: monthEndIso(input.monthStart),
    p_branch: input.branch,
    p_side: input.side,
    p_expense: "created",
  });
  if (error) throw error;
  if (!Array.isArray(data)) return [];

  const rows: VatRegisterRow[] = (data as Record<string, unknown>[]).map((row): VatRegisterRow => {
    const status: VatPaidStatus =
      asString(row.paid_status) === "paid" ? "paid" : "unpaid";
    return {
      line_key: asString(row.line_key),
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
      party_code: asNullable(row.party_code),
      tax_id: asNullable(row.tax_id),
      before_vat: asNumber(row.before_vat),
      vat: asNumber(row.vat),
      after_vat: asNumber(row.after_vat),
      detail: asNullable(row.detail),
      remark: asNullable(row.remark),
      paid_status: status,
      paid_on: row.paid_on ? asString(row.paid_on).slice(0, 10) : null,
      paid_from_reminder: row.paid_from_reminder === true,
      note: asNullable(row.note),
      invoice_count: asNumber(row.invoice_count),
      receipt_count: asNumber(row.receipt_count),
    };
  });
  return attachPurchaseCreditors(supabase, rows, input.monthStart);
}

function nextMonthStart(monthStart: string): string {
  const [year, month] = monthStart.slice(0, 7).split("-").map(Number);
  const next = new Date(Date.UTC(year, month, 1));
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

async function attachPurchaseCreditors(
  supabase: SupabaseClient,
  rows: VatRegisterRow[],
  monthStart: string
): Promise<VatRegisterRow[]> {
  const wanted = rows.some(
    (row) => row.side === "purchase" && row.source !== "expense"
  );
  if (!wanted) return rows;

  const { data, error } = await supabase
    .schema("raw_kcw")
    .from("raw_hq_pimas_purchase_bills")
    .select("BILLNO, ACCTNO, ACCTNAME")
    .gte("BILLDATE", monthStart)
    .lt("BILLDATE", nextMonthStart(monthStart))
    .limit(5000);
  if (error || !Array.isArray(data)) return rows;

  const byBill = new Map<string, { code: string | null; name: string | null }>();
  for (const record of data as Record<string, unknown>[]) {
    const billNo = asString(record.BILLNO).trim().toUpperCase();
    if (!billNo) continue;
    const next = creditorIdentity({
      code: asNullable(record.ACCTNO),
      name: asNullable(record.ACCTNAME),
    });
    const prev = byBill.get(billNo);
    if (!prev || (!prev.name && next.name) || (!prev.code && next.code)) {
      byBill.set(billNo, next);
    }
  }

  const missing = [
    ...new Set(
      [...byBill.values()]
        .filter((party) => party.code && !party.name)
        .map((party) => party.code as string)
    ),
  ];
  if (missing.length > 0) {
    const masters = await supabase
      .schema("raw_kcw")
      .from("raw_hq_apmas_payable")
      .select("ACCTNO, ACCTNAME")
      .in("ACCTNO", missing)
      .limit(missing.length);
    if (!masters.error && Array.isArray(masters.data)) {
      const names = new Map<string, string>();
      for (const record of masters.data as Record<string, unknown>[]) {
        const code = asNullable(record.ACCTNO);
        const name = asNullable(record.ACCTNAME);
        if (code && name && name !== code) names.set(code, name);
      }
      for (const [billNo, party] of byBill) {
        if (party.code && !party.name && names.has(party.code)) {
          byBill.set(billNo, { code: party.code, name: names.get(party.code) ?? null });
        }
      }
    }
  }

  return rows.map((row) => {
    if (row.side !== "purchase" || row.source === "expense") return row;
    const party = byBill.get(row.bill_no.trim().toUpperCase());
    if (!party) return row;
    return {
      ...row,
      party_code: party.code ?? row.party_code,
      party_name: row.party_name || party.name,
    };
  });
}

export async function findVatRegisterLine(
  supabase: SupabaseClient,
  lineKey: string,
  monthStart: string
): Promise<{
  line_key: string;
  branch: string;
  side: string;
  sheet: string;
  bill_no: string;
  bill_date: string;
  source: string;
  source_ref: string | null;
} | null> {
  const { data, error } = await supabase.rpc("fn_vat_register_line", {
    p_from: monthStart,
    p_to: monthEndIso(monthStart),
    p_line_key: lineKey,
    p_expense: "created",
  });
  if (error) throw error;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const row = data as Record<string, unknown>;
  if (!asString(row.line_key)) return null;
  return {
    line_key: asString(row.line_key),
    branch: asString(row.branch),
    side: asString(row.side),
    sheet: asString(row.sheet),
    bill_no: asString(row.bill_no),
    bill_date: asString(row.bill_date).slice(0, 10),
    source: asString(row.source),
    source_ref: asNullable(row.source_ref),
  };
}
