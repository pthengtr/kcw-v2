import type { SupabaseClient } from "@supabase/supabase-js";

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

  return (data as Record<string, unknown>[]).map((row) => {
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
      tax_id: asNullable(row.tax_id),
      before_vat: asNumber(row.before_vat),
      vat: asNumber(row.vat),
      after_vat: asNumber(row.after_vat),
      detail: asNullable(row.detail),
      remark: asNullable(row.remark),
      paid_status: status,
      paid_on: row.paid_on ? asString(row.paid_on).slice(0, 10) : null,
      note: asNullable(row.note),
      invoice_count: asNumber(row.invoice_count),
      receipt_count: asNumber(row.receipt_count),
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
    source_ref: asNullable(row.source_ref),
  };
}
