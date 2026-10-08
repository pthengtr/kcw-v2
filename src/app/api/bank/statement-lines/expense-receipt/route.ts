import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/requirePermission";
import { BANK_STATEMENT_READ_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { expenseReceiptTotals } from "@/lib/bank/statement-doc-links";
import { isDocumentBillToken } from "@/lib/bank/statement-report-format";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_IDS = 20;

const QuerySchema = z.object({
  ids: z.string().trim().min(1).max(2000),
});

type NameRel = { party_name?: string | null; payment_description?: string | null };

function relatedText(
  value: NameRel | NameRel[] | null | undefined,
  key: "party_name" | "payment_description",
): string | null {
  const row = Array.isArray(value) ? value[0] : value;
  const text = String(row?.[key] ?? "").trim();
  return text || null;
}

function num(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateOnly(value: string | null | undefined): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return text.slice(0, 10);
}

export async function GET(req: Request) {
  const permCheck = await requirePermission(BANK_STATEMENT_READ_PAGE_KEYS);
  if (!permCheck.ok) {
    return NextResponse.json(
      { error: permCheck.message },
      { status: permCheck.status },
    );
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    ids: url.searchParams.get("ids") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const ids = [...new Set(
    parsed.data.ids
      .split(/[,;|]+/)
      .map((id) => id.trim())
      .filter((id) => UUID_RE.test(id) || isDocumentBillToken(id)),
  )];

  if (ids.length === 0 || ids.length > MAX_IDS) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const uuidIds = ids.filter((id) => UUID_RE.test(id));
  const numberIds = ids.filter((id) => !UUID_RE.test(id));
  const supabase = createAdminClient();

  const receiptSelect =
    "receipt_uuid,receipt_number,receipt_date,voucher_description,total_amount,discount,vat,withholding,tax_exempt,party:party_uuid(party_name),payment_method:payment_uuid(payment_description)";

  const [byUuid, byNumber] = await Promise.all([
    uuidIds.length
      ? supabase.from("expense_receipt").select(receiptSelect).in("receipt_uuid", uuidIds)
      : Promise.resolve({ data: [], error: null }),
    numberIds.length
      ? supabase.from("expense_receipt").select(receiptSelect).in("receipt_number", numberIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (byUuid.error || byNumber.error) {
    return NextResponse.json(
      { error: byUuid.error?.message ?? byNumber.error?.message ?? "โหลดใบสำคัญไม่สำเร็จ" },
      { status: 500 },
    );
  }

  type ReceiptRow = {
    receipt_uuid: string;
    receipt_number: string | null;
    receipt_date: string | null;
    voucher_description: string | null;
    total_amount: number | null;
    discount: number | null;
    vat: number | null;
    withholding: number | null;
    tax_exempt: number | null;
    party: NameRel | NameRel[] | null;
    payment_method: NameRel | NameRel[] | null;
  };

  const receipts = [...(byUuid.data ?? []), ...(byNumber.data ?? [])] as ReceiptRow[];
  const byId = new Map<string, ReceiptRow>();
  for (const receipt of receipts) {
    byId.set(receipt.receipt_uuid, receipt);
    const number = String(receipt.receipt_number ?? "").trim();
    if (number) byId.set(number, receipt);
  }

  const ordered: ReceiptRow[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const receipt = byId.get(id);
    if (!receipt || seen.has(receipt.receipt_uuid)) continue;
    seen.add(receipt.receipt_uuid);
    ordered.push(receipt);
  }

  const receiptIds = ordered.map((receipt) => receipt.receipt_uuid);
  const { data: entryData, error: entryError } = receiptIds.length
    ? await supabase
        .from("expense_entry")
        .select("receipt_uuid,entry_detail,quantity,unit_price,entry_amount,entry_uuid,expense_item(item_name)")
        .in("receipt_uuid", receiptIds)
        .order("entry_uuid", { ascending: true })
    : { data: [], error: null };

  if (entryError) {
    return NextResponse.json({ error: entryError.message }, { status: 500 });
  }

  type EntryRow = {
    receipt_uuid: string;
    entry_detail: string | null;
    quantity: number | null;
    unit_price: number | null;
    entry_amount: number | null;
    expense_item: { item_name?: string | null } | { item_name?: string | null }[] | null;
  };

  const linesByReceipt = new Map<string, EntryRow[]>();
  for (const entry of (entryData ?? []) as EntryRow[]) {
    const list = linesByReceipt.get(entry.receipt_uuid) ?? [];
    list.push(entry);
    linesByReceipt.set(entry.receipt_uuid, list);
  }

  return NextResponse.json({
    receipts: ordered.map((receipt) => {
      const lines = linesByReceipt.get(receipt.receipt_uuid) ?? [];
      const lineAmounts = lines.length
        ? lines.map((line) => num(line.entry_amount))
        : [num(receipt.total_amount)];
      const totals = expenseReceiptTotals({
        lineAmounts,
        discount: num(receipt.discount),
        taxExempt: num(receipt.tax_exempt),
        vatRate: num(receipt.vat),
        withholdingRate: num(receipt.withholding),
      });
      return {
        receipt_uuid: receipt.receipt_uuid,
        receipt_number: String(receipt.receipt_number ?? "").trim(),
        receipt_date: dateOnly(receipt.receipt_date),
        party_name: relatedText(receipt.party, "party_name"),
        payment_description: relatedText(receipt.payment_method, "payment_description"),
        voucher_description: String(receipt.voucher_description ?? "").trim() || null,
        vat_rate: num(receipt.vat),
        withholding_rate: num(receipt.withholding),
        ...totals,
        lines: lines.map((line) => {
          const item = Array.isArray(line.expense_item) ? line.expense_item[0] : line.expense_item;
          return {
            item_name: String(item?.item_name ?? "").trim() || null,
            detail: String(line.entry_detail ?? "").trim() || null,
            qty: num(line.quantity),
            price: num(line.unit_price),
            amount: num(line.entry_amount),
          };
        }),
      };
    }),
  });
}
