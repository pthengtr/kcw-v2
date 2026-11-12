import type { SupabaseClient } from "@supabase/supabase-js";

import { creditorIdentity } from "@/lib/po/creditor";

import { displayInvoiceCount } from "./generated-bill";
import {
  applyIssuedFullInvoices,
  fullInvoiceLineKey,
  monthEndIso,
  monthStartIso,
  vatLineKey,
  type IssuedFullInvoice,
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
    basis?: "bill" | "accounting";
  }
): Promise<VatRegisterRow[]> {
  const basis = input.basis ?? "bill";
  const { data, error } =
    basis === "accounting"
      ? await supabase.rpc("fn_vat_register_accounting_json", {
          p_month: input.monthStart,
          p_branch: input.branch,
          p_side: input.side,
        })
      : await supabase.rpc("fn_vat_register_json", {
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
      bill_month: row.bill_month ? asString(row.bill_month).slice(0, 10) : null,
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
      book_before_vat:
        row.book_before_vat == null ? asNumber(row.before_vat) : asNumber(row.book_before_vat),
      book_vat: row.book_vat == null ? asNumber(row.vat) : asNumber(row.book_vat),
      book_after_vat:
        row.book_after_vat == null ? asNumber(row.after_vat) : asNumber(row.book_after_vat),
      amount_overridden: row.amount_overridden === true,
      detail: asNullable(row.detail),
      remark: asNullable(row.remark),
      paid_status: status,
      paid_on: row.paid_on ? asString(row.paid_on).slice(0, 10) : null,
      paid_from_reminder: row.paid_from_reminder === true,
      note: asNullable(row.note),
      doc_month: row.doc_month ? asString(row.doc_month).slice(0, 10) : null,
      accounting_month: row.accounting_month
        ? asString(row.accounting_month).slice(0, 10)
        : null,
      first_uploaded_at: row.first_uploaded_at
        ? asString(row.first_uploaded_at)
        : null,
      last_uploaded_at: row.last_uploaded_at ? asString(row.last_uploaded_at) : null,
      invoice_count: displayInvoiceCount(asString(row.sheet), asNumber(row.invoice_count)),
      receipt_count: asNumber(row.receipt_count),
      accounting_unused: row.accounting_unused === true,
      full_invoice_docno: null,
    };
  });
  const withCreditors = await attachPurchaseCreditors(supabase, rows, input.monthStart);
  const enriched = await attachFullInvoices(supabase, withCreditors);
  if (basis !== "accounting") return enriched;
  // After TAD↔TO enrich, accounting_month may move to the TAD bill month.
  const want = input.monthStart.slice(0, 7);
  return enriched.filter((row) => {
    const acct = row.accounting_month?.slice(0, 7) ?? row.doc_month?.slice(0, 7);
    if (!acct) return true;
    return acct === want;
  });
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

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}

async function attachFullInvoices(
  supabase: SupabaseClient,
  rows: VatRegisterRow[]
): Promise<VatRegisterRow[]> {
  const tadBills = [
    ...new Set(
      rows
        .filter((row) => row.side === "sales" && row.sheet === "TAD")
        .map((row) => row.bill_no.trim().toUpperCase())
        .filter((billno) => billno.startsWith("TAD"))
    ),
  ];
  if (tadBills.length === 0) return rows;

  const invoices: IssuedFullInvoice[] = [];
  for (const group of chunk(tadBills, 150)) {
    const { data, error } = await supabase
      .schema("to_bill")
      .from("invoices")
      .select("tad_billno,docno,customer_name,tax_id,beforetax,tax,aftertax,bill_date")
      .eq("status", "issued")
      .in("tad_billno", group);
    // Don't blank the whole VAT register if full-invoice enrichment fails
    // (e.g. PostgREST schema exposure drift). Book lines still load.
    if (error) {
      console.error("vat register attachFullInvoices", error);
      return rows;
    }
    for (const record of (data ?? []) as Record<string, unknown>[]) {
      invoices.push({
        tad_billno: asString(record.tad_billno),
        docno: asString(record.docno),
        customer_name: asString(record.customer_name),
        tax_id: asString(record.tax_id),
        before_vat: asNumber(record.beforetax),
        vat: asNumber(record.tax),
        after_vat: asNumber(record.aftertax),
        bill_date: asNullable(record.bill_date)?.slice(0, 10) ?? null,
      });
    }
  }
  return applyIssuedFullInvoices(rows, invoices);
}

async function findIssuedFullInvoiceLine(
  supabase: SupabaseClient,
  lineKey: string,
  monthStart: string
) {
  // TO line_key uses the parent TAD bill_date (TO follows TAD), so resolve via
  // TAD book lines in the report month rather than the TO issue date.
  const { data: bookJson, error: bookError } = await supabase.rpc(
    "fn_vat_register_json",
    {
      p_from: monthStart,
      p_to: monthEndIso(monthStart),
      p_branch: null,
      p_side: "sales",
      p_expense: "created",
    }
  );
  if (bookError) throw bookError;
  if (!Array.isArray(bookJson)) return null;

  const tadRows = (bookJson as Record<string, unknown>[]).filter(
    (row) =>
      asString(row.sheet) === "TAD" &&
      asString(row.bill_no).trim().toUpperCase().startsWith("TAD")
  );
  if (tadRows.length === 0) return null;

  const tadNos = [
    ...new Set(
      tadRows.map((row) => asString(row.bill_no).trim().toUpperCase())
    ),
  ];
  const invoices = new Map<string, string>();
  for (const group of chunk(tadNos, 150)) {
    const { data, error } = await supabase
      .schema("to_bill")
      .from("invoices")
      .select("tad_billno,docno")
      .eq("status", "issued")
      .in("tad_billno", group);
    if (error) throw error;
    for (const record of (data ?? []) as Record<string, unknown>[]) {
      const tad = asString(record.tad_billno).trim().toUpperCase();
      const docno = asString(record.docno).trim().toUpperCase();
      if (!tad || !/^TO\d{4}-\d{3,}$/.test(docno)) continue;
      invoices.set(tad, docno);
    }
  }

  for (const row of tadRows) {
    const tadNo = asString(row.bill_no).trim().toUpperCase();
    const docno = invoices.get(tadNo);
    if (!docno) continue;
    const billDate = asString(row.bill_date).slice(0, 10);
    const branch = asString(row.branch) || "HQ";
    if (fullInvoiceLineKey(docno, billDate, branch) !== lineKey) continue;
    return {
      line_key: lineKey,
      branch,
      side: "sales",
      sheet: "TO",
      bill_no: docno,
      bill_date: billDate,
      source: "to_bill",
      source_ref: null,
    };
  }
  return null;
}

export type VatEvidenceLine = {
  line_key: string;
  branch: string;
  side: string;
  sheet: string;
  bill_no: string;
  bill_date: string;
  source: string;
  source_ref: string | null;
};

/** TAD ↔ TO partners that share a doc_month override (DOC follows TAD). */
export async function findVatDocMonthSyncTargets(
  supabase: SupabaseClient,
  line: VatEvidenceLine,
  monthStart: string
): Promise<VatEvidenceLine[]> {
  const targets: VatEvidenceLine[] = [line];

  if (line.sheet === "TAD" && line.side === "sales") {
    const { data, error } = await supabase
      .schema("to_bill")
      .from("invoices")
      .select("docno")
      .eq("status", "issued")
      .eq("tad_billno", line.bill_no)
      .limit(1);
    if (error) throw error;
    const docno = asString(
      (data as Record<string, unknown>[] | null)?.[0]?.docno
    )
      .trim()
      .toUpperCase();
    if (/^TO\d{4}-\d{3,}$/.test(docno)) {
      targets.push({
        line_key: fullInvoiceLineKey(docno, line.bill_date, line.branch),
        branch: line.branch,
        side: "sales",
        sheet: "TO",
        bill_no: docno,
        bill_date: line.bill_date,
        source: "to_bill",
        source_ref: null,
      });
    }
    return targets;
  }

  if (line.sheet === "TO" && line.side === "sales") {
    const { data, error } = await supabase
      .schema("to_bill")
      .from("invoices")
      .select("tad_billno")
      .eq("status", "issued")
      .eq("docno", line.bill_no)
      .limit(1);
    if (error) throw error;
    const tadNo = asString(
      (data as Record<string, unknown>[] | null)?.[0]?.tad_billno
    )
      .trim()
      .toUpperCase();
    if (!tadNo.startsWith("TAD")) return targets;

    const tadKey = vatLineKey({
      branch: line.branch,
      side: "sales",
      sheet: "TAD",
      billNo: tadNo,
      billDate: line.bill_date,
      sourceRef: null,
    });
    const tad =
      (await findVatRegisterLine(supabase, tadKey, monthStart)) ??
      ({
        line_key: tadKey,
        branch: line.branch,
        side: "sales",
        sheet: "TAD",
        bill_no: tadNo,
        bill_date: line.bill_date,
        source: "parts9",
        source_ref: null,
      } satisfies VatEvidenceLine);
    // Prefer writing TAD first so DOC membership follows TAD.
    return [tad, line];
  }

  return targets;
}

/** YYYY-MM or YYYY-MM-01 → YYYY-MM-01; empty → null. */
export function normalizeVatDocMonth(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  const text = value.trim().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(text)) return null;
  return monthStartIso(text);
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
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const row = data as Record<string, unknown>;
    if (asString(row.line_key)) {
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
  }
  return findIssuedFullInvoiceLine(supabase, lineKey, monthStart);
}
