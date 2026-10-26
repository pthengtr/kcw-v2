/**
 * Resolve matched party/company names and human bill numbers for the
 * monthly bank statement report. Presentation-only — does not write matches.
 */
import type { StatementLineRow } from "./statement-report-format";
import {
  isDocumentBillToken,
  normalizePartyDisplayName,
  splitRefIds,
} from "./statement-report-format";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type NameBill = {
  name: string;
  bill: string;
  date: string;
  payment?: string;
  item?: string;
};

/** Minimal admin client used by report party lookup (Next.js + Edge Function). */
export type StatementLabelAdmin = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: (name: string) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

function normalizeBillDate(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  return "";
}

function normalizeRefType(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function chunk<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function fetchNameMapByKeys(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: () => Promise<{ data: any[] | null; error: { message: string } | null }>,
  keyField: string,
  nameField: string,
  billField?: string,
  dateField?: string,
): Promise<Map<string, NameBill>> {
  const map = new Map<string, NameBill>();
  const { data, error } = await query();
  if (error) {
    console.error("party lookup failed", error.message);
    return map;
  }
  for (const row of data ?? []) {
    const key = String(row[keyField] ?? "").trim();
    if (!key) continue;
    const name = normalizePartyDisplayName(String(row[nameField] ?? "").trim());
    const bill = String(row[billField ?? keyField] ?? key).trim();
    const date = dateField ? normalizeBillDate(row[dateField]) : "";
    if (!map.has(key)) {
      map.set(key, { name, bill, date });
    }
  }
  return map;
}

async function lookupVoucherAcctNames(
  admin: StatementLabelAdmin,
  schema: "raw_kcw",
  table: string,
  keys: string[],
): Promise<Map<string, NameBill>> {
  const map = new Map<string, NameBill>();
  for (const batch of chunk(keys, 200)) {
    const partial = await fetchNameMapByKeys(
      () =>
        admin
          .schema(schema)
          .from(table)
          .select("VOUCNO,ACCTNAME")
          .in("VOUCNO", batch),
      "VOUCNO",
      "ACCTNAME",
      "VOUCNO",
    );
    for (const [k, v] of partial) map.set(k, v);
  }
  return map;
}

async function lookupBillAcctNames(
  admin: StatementLabelAdmin,
  schema: "raw_kcw" | "curated_kcw",
  table: string,
  keys: string[],
  dateField?: string,
): Promise<Map<string, NameBill>> {
  const map = new Map<string, NameBill>();
  const select = dateField ? `BILLNO,ACCTNAME,${dateField}` : "BILLNO,ACCTNAME";
  for (const batch of chunk(keys, 200)) {
    const partial = await fetchNameMapByKeys(
      () =>
        admin
          .schema(schema)
          .from(table)
          .select(select)
          .in("BILLNO", batch),
      "BILLNO",
      "ACCTNAME",
      "BILLNO",
      dateField,
    );
    for (const [k, v] of partial) map.set(k, v);
  }
  return map;
}

function relatedText(
  value: { party_name?: string | null; payment_description?: string | null; item_name?: string | null }
    | Array<{ party_name?: string | null; payment_description?: string | null; item_name?: string | null }>
    | null
    | undefined,
  key: "party_name" | "payment_description" | "item_name",
): string {
  const row = Array.isArray(value) ? value[0] : value;
  return String(row?.[key] ?? "").trim();
}

async function lookupExpenseReceipts(
  admin: StatementLabelAdmin,
  uuids: string[],
): Promise<Map<string, NameBill>> {
  const map = new Map<string, NameBill>();
  const itemsByReceipt = new Map<string, string[]>();
  for (const batch of chunk(uuids, 200)) {
    const [{ data, error }, entries] = await Promise.all([
      admin
        .from("expense_receipt")
        .select(
          "receipt_uuid,receipt_number,voucher_description,party:party_uuid(party_name),payment_method:payment_uuid(payment_description)",
        )
        .in("receipt_uuid", batch),
      admin
        .from("expense_entry")
        .select("receipt_uuid,expense_item(item_name)")
        .in("receipt_uuid", batch),
    ]);
    if (error) {
      console.error("expense_receipt lookup failed", error.message);
      continue;
    }
    if (entries.error) {
      console.error("expense_entry lookup failed", entries.error.message);
    } else {
      for (const entry of entries.data ?? []) {
        const id = String(entry.receipt_uuid ?? "").trim();
        const item = relatedText(entry.expense_item, "item_name");
        if (!id || !item) continue;
        const list = itemsByReceipt.get(id) ?? [];
        if (!list.includes(item)) list.push(item);
        itemsByReceipt.set(id, list);
      }
    }
    for (const row of data ?? []) {
      const id = String(row.receipt_uuid ?? "").trim();
      if (!id) continue;
      const name = normalizePartyDisplayName(relatedText(row.party, "party_name"));
      const bill = String(row.receipt_number ?? "").trim();
      const items = itemsByReceipt.get(id) ?? [];
      const voucher = String(row.voucher_description ?? "").trim();
      map.set(id, {
        name,
        bill,
        date: "",
        payment: relatedText(row.payment_method, "payment_description"),
        item: items.join(", ") || voucher,
      });
    }
  }
  return map;
}

/** Shop + expense item, only when every receipt is a director reimbursement. */
function expenseReimbursementLabel(
  ids: string[],
  lookup: Map<string, NameBill>,
): { payment: string; label: string } {
  const payments: string[] = [];
  const seenPay = new Set<string>();
  const byShop = new Map<string, string[]>();

  for (const id of ids) {
    const hit = lookup.get(id);
    if (!hit) continue;
    const payment = (hit.payment ?? "").trim();
    if (payment && !seenPay.has(payment)) {
      seenPay.add(payment);
      payments.push(payment);
    }
    const shop = normalizePartyDisplayName(hit.name);
    if (!shop) continue;
    const items = byShop.get(shop) ?? [];
    const item = (hit.item ?? "").trim();
    if (item && !items.includes(item)) items.push(item);
    byShop.set(shop, items);
  }

  const allReimburse =
    payments.length > 0 && payments.every((payment) => /คืนเงินสำรอง/u.test(payment));
  if (!allReimburse) {
    return { payment: payments.join(", "), label: "" };
  }

  const segments = [...byShop.entries()].map(([shop, items]) =>
    items.length ? `${shop} ${items.join(", ")}` : shop,
  );
  return { payment: payments.join(", "), label: segments.join(", ") };
}

function collectIdsByType(
  rows: StatementLineRow[],
): Record<string, Set<string>> {
  const buckets: Record<string, Set<string>> = {
    rvmas: new Set(),
    pvmas: new Set(),
    pimas: new Set(),
    sales: new Set(),
    expense: new Set(),
  };

  for (const row of rows) {
    const t = normalizeRefType(row.matched_ref_type);
    const ids = splitRefIds(row.matched_ref_id);
    if (!t || ids.length === 0) continue;

    if (t === "rvmas" || t === "rvi") {
      for (const id of ids) buckets.rvmas.add(id);
    } else if (t === "pvmas") {
      for (const id of ids) buckets.pvmas.add(id);
    } else if (t === "pimas" || t === "pimas_possible_bundle") {
      for (const id of ids) buckets.pimas.add(id);
    } else if (
      t === "tr_bill" ||
      t === "tr_bundle" ||
      t === "tr_remainder" ||
      t === "3tr_bill"
    ) {
      for (const id of ids) buckets.sales.add(id);
    } else if (t === "expense_pv") {
      for (const id of ids) {
        if (UUID_RE.test(id)) buckets.expense.add(id);
      }
    }
  }

  return buckets;
}

function pickNamesBills(
  ids: string[],
  lookup: Map<string, NameBill>,
): { name: string; bills: string; date: string } {
  const names: string[] = [];
  const bills: string[] = [];
  const dates: string[] = [];
  const seenName = new Set<string>();
  const seenBill = new Set<string>();
  const seenDate = new Set<string>();

  for (const id of ids) {
    const hit = lookup.get(id);
    if (hit?.name && !seenName.has(hit.name)) {
      seenName.add(hit.name);
      names.push(hit.name);
    }
    const bill = hit?.bill && isDocumentBillToken(hit.bill) ? hit.bill : "";
    // Fall back to the id itself when it already looks like a bill number.
    const billOut = bill || (isDocumentBillToken(id) ? id : "");
    if (billOut && !seenBill.has(billOut)) {
      seenBill.add(billOut);
      bills.push(billOut);
    }
    const date = hit?.date?.trim() ?? "";
    if (date && !seenDate.has(date)) {
      seenDate.add(date);
      dates.push(date);
    }
  }

  return {
    name: names[0] ?? "",
    bills: bills.join(", "),
    date: dates[0] ?? "",
  };
}

/**
 * Attach matched_party_name / matched_bill_nos onto each statement line
 * using source document masters. Failures are logged and skipped.
 */
export async function attachMatchedPartyAndBills(
  admin: StatementLabelAdmin,
  rows: StatementLineRow[],
): Promise<StatementLineRow[]> {
  if (rows.length === 0) return rows;

  const buckets = collectIdsByType(rows);

  const [rvmas, pvmas, pimas, sales, expense] = await Promise.all([
    lookupVoucherAcctNames(
      admin,
      "raw_kcw",
      "raw_hq_rvmas_notes_vouchers",
      [...buckets.rvmas],
    ),
    lookupVoucherAcctNames(
      admin,
      "raw_kcw",
      "raw_hq_pvmas_notes_vouchers",
      [...buckets.pvmas],
    ),
    lookupBillAcctNames(
      admin,
      "raw_kcw",
      "raw_hq_pimas_purchase_bills",
      [...buckets.pimas],
    ),
    lookupBillAcctNames(
      admin,
      "curated_kcw",
      "fact_sales_bills_all",
      [...buckets.sales],
      "BILLDATE",
    ),
    lookupExpenseReceipts(admin, [...buckets.expense]),
  ]);

  return rows.map((row) => {
    const t = normalizeRefType(row.matched_ref_type);
    const ids = splitRefIds(row.matched_ref_id);
    if (!t || ids.length === 0) return row;

    let picked = { name: "", bills: "", date: "" };
    let expenseExtra = { payment: "", label: "" };
    if (t === "rvmas" || t === "rvi") {
      picked = pickNamesBills(ids, rvmas);
    } else if (t === "pvmas") {
      picked = pickNamesBills(ids, pvmas);
    } else if (t === "pimas" || t === "pimas_possible_bundle") {
      picked = pickNamesBills(ids, pimas);
    } else if (
      t === "tr_bill" ||
      t === "tr_bundle" ||
      t === "tr_remainder" ||
      t === "3tr_bill"
    ) {
      picked = pickNamesBills(ids, sales);
    } else if (t === "expense_pv") {
      picked = pickNamesBills(ids, expense);
      expenseExtra = expenseReimbursementLabel(ids, expense);
    }

    return {
      ...row,
      matched_party_name: picked.name || row.matched_party_name || null,
      matched_bill_nos: picked.bills || row.matched_bill_nos || null,
      matched_bill_date: picked.date || row.matched_bill_date || null,
      ...(t === "expense_pv"
        ? {
            matched_payment_description: expenseExtra.payment || null,
            matched_expense_label: expenseExtra.label || null,
          }
        : {}),
    };
  });
}
