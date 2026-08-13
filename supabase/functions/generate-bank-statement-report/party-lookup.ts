/**
 * Resolve matched party/company names and human bill numbers for the
 * monthly bank statement report. Presentation-only — does not write matches.
 */
import type { StatementLineRow } from "./report-format.ts";
import {
  isDocumentBillToken,
  normalizePartyDisplayName,
  splitRefIds,
} from "./report-format.ts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type NameBill = { name: string; bill: string };

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
  // deno-lint-ignore no-explicit-any
  query: () => Promise<{ data: any[] | null; error: { message: string } | null }>,
  keyField: string,
  nameField: string,
  billField?: string,
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
    if (!map.has(key)) {
      map.set(key, { name, bill });
    }
  }
  return map;
}

async function lookupVoucherAcctNames(
  // deno-lint-ignore no-explicit-any
  admin: any,
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
  // deno-lint-ignore no-explicit-any
  admin: any,
  schema: "raw_kcw" | "curated_kcw",
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
          .select("BILLNO,ACCTNAME")
          .in("BILLNO", batch),
      "BILLNO",
      "ACCTNAME",
      "BILLNO",
    );
    for (const [k, v] of partial) map.set(k, v);
  }
  return map;
}

async function lookupExpenseReceipts(
  // deno-lint-ignore no-explicit-any
  admin: any,
  uuids: string[],
): Promise<Map<string, NameBill>> {
  const map = new Map<string, NameBill>();
  for (const batch of chunk(uuids, 200)) {
    const { data, error } = await admin
      .from("expense_receipt")
      .select("receipt_uuid,receipt_number,party:party_uuid(party_name)")
      .in("receipt_uuid", batch);
    if (error) {
      console.error("expense_receipt lookup failed", error.message);
      continue;
    }
    for (const row of data ?? []) {
      const id = String(row.receipt_uuid ?? "").trim();
      if (!id) continue;
      const partyRel = row.party;
      const partyObj = Array.isArray(partyRel) ? partyRel[0] : partyRel;
      const name = normalizePartyDisplayName(
        String(partyObj?.party_name ?? "").trim(),
      );
      const bill = String(row.receipt_number ?? "").trim();
      map.set(id, { name, bill });
    }
  }
  return map;
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
): { name: string; bills: string } {
  const names: string[] = [];
  const bills: string[] = [];
  const seenName = new Set<string>();
  const seenBill = new Set<string>();

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
  }

  return {
    name: names[0] ?? "",
    bills: bills.join(", "),
  };
}

/**
 * Attach matched_party_name / matched_bill_nos onto each statement line
 * using source document masters. Failures are logged and skipped.
 */
export async function attachMatchedPartyAndBills(
  // deno-lint-ignore no-explicit-any
  admin: any,
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
    ),
    lookupExpenseReceipts(admin, [...buckets.expense]),
  ]);

  return rows.map((row) => {
    const t = normalizeRefType(row.matched_ref_type);
    const ids = splitRefIds(row.matched_ref_id);
    if (!t || ids.length === 0) return row;

    let picked = { name: "", bills: "" };
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
    }

    return {
      ...row,
      matched_party_name: picked.name || row.matched_party_name || null,
      matched_bill_nos: picked.bills || row.matched_bill_nos || null,
    };
  });
}
