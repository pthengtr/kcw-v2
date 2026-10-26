import { normalizeSalesBillDocType } from "@/lib/sales/bill-detail";

const NO_FIFO_DOCS = new Set(["CNTAR", "3CNTAR", "CNTAD", "3CNTAD", "CN", "3CN"]);

export type FifoCostStatus = "OK" | "PARTIAL" | "UNCOSTED";
export type FifoMarginStatus = FifoCostStatus | "MISSING";

export type FifoPiBill = {
  pi_billno: string;
  pi_billdate: string | null;
  qty: number;
  ext_cost: number;
};

export type BillFifoCost = {
  billno: string;
  site: string;
  fifo_ext_cost: number;
  units: number;
  line_count: number;
  uncosted_lines: number;
  partial_lines: number;
  status: FifoCostStatus;
  pi_bills: FifoPiBill[];
};

export type FifoMargin = {
  revenue: number;
  fifo_ext_cost: number;
  profit: number;
  margin_pct: number | null;
  status: FifoMarginStatus;
  pi_bills: FifoPiBill[];
  costed_bills: number;
  expected_bills: number;
};

export type FifoMarginBrief = {
  revenue: number;
  fifo_ext_cost: number;
  profit: number;
  margin_pct: number | null;
  status: FifoMarginStatus;
  costed_bills: number;
  expected_bills: number;
  pi_bill_count: number;
};

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Credit notes reduce the sale total. They are not FIFO sale lines. */
export function saleBillTakesFifo(billno: string, docType?: string | null): boolean {
  return !NO_FIFO_DOCS.has(normalizeSalesBillDocType(billno, docType));
}

/** HQ bills stay on site hq. A leading 3 is the SYP series. */
export function fifoSiteForBillnos(billnos: string[]): "hq" | "syp" | null {
  const sites = new Set<"hq" | "syp">();
  for (const raw of billnos) {
    const bill = raw.trim().toUpperCase();
    if (!bill) continue;
    sites.add(bill.startsWith("3") ? "syp" : "hq");
  }
  if (sites.size !== 1) return null;
  return sites.values().next().value ?? null;
}

function parsePiBills(value: unknown): FifoPiBill[] {
  if (!Array.isArray(value)) return [];
  const bills: FifoPiBill[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const piBillno = String(rec.pi_billno ?? "").trim();
    if (!piBillno) continue;
    const piDate = rec.pi_billdate == null ? null : String(rec.pi_billdate).slice(0, 10);
    bills.push({
      pi_billno: piBillno,
      pi_billdate: piDate || null,
      qty: num(rec.qty),
      ext_cost: roundMoney(num(rec.ext_cost)),
    });
  }
  return mergePiBills(bills);
}

function costStatus(value: unknown): FifoCostStatus {
  if (value === "OK" || value === "PARTIAL" || value === "UNCOSTED") return value;
  return "PARTIAL";
}

function worseStatus(left: FifoCostStatus, right: FifoCostStatus): FifoCostStatus {
  const rank: Record<FifoCostStatus, number> = { OK: 0, PARTIAL: 1, UNCOSTED: 2 };
  return rank[left] >= rank[right] ? left : right;
}

export function mergePiBills(bills: FifoPiBill[]): FifoPiBill[] {
  const map = new Map<string, FifoPiBill>();
  for (const bill of bills) {
    const key = `${bill.pi_billno}|${bill.pi_billdate ?? ""}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...bill, ext_cost: roundMoney(bill.ext_cost) });
      continue;
    }
    map.set(key, {
      ...prev,
      qty: prev.qty + bill.qty,
      ext_cost: roundMoney(prev.ext_cost + bill.ext_cost),
    });
  }
  return [...map.values()].sort((a, b) => {
    const date = (a.pi_billdate ?? "").localeCompare(b.pi_billdate ?? "");
    if (date !== 0) return date;
    return a.pi_billno.localeCompare(b.pi_billno);
  });
}

export function parseBillFifoRows(data: unknown): BillFifoCost[] {
  let rows: unknown = data;
  if (typeof data === "string") {
    try {
      rows = JSON.parse(data);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(rows)) return [];
  const parsed: BillFifoCost[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const billno = String(rec.billno ?? "").trim();
    if (!billno) continue;
    parsed.push({
      billno,
      site: String(rec.site ?? "").trim().toLowerCase(),
      fifo_ext_cost: roundMoney(num(rec.fifo_ext_cost)),
      units: num(rec.units),
      line_count: Math.trunc(num(rec.line_count)),
      uncosted_lines: Math.trunc(num(rec.uncosted_lines)),
      partial_lines: Math.trunc(num(rec.partial_lines)),
      status: costStatus(rec.status),
      pi_bills: parsePiBills(rec.pi_bills),
    });
  }
  return mergeBillFifo(parsed);
}

export function mergeBillFifo(costs: BillFifoCost[]): BillFifoCost[] {
  const map = new Map<string, BillFifoCost>();
  for (const cost of costs) {
    const prev = map.get(cost.billno);
    if (!prev) {
      map.set(cost.billno, {
        ...cost,
        pi_bills: mergePiBills(cost.pi_bills),
      });
      continue;
    }
    map.set(cost.billno, {
      ...prev,
      site: prev.site === cost.site ? prev.site : "",
      fifo_ext_cost: roundMoney(prev.fifo_ext_cost + cost.fifo_ext_cost),
      units: prev.units + cost.units,
      line_count: prev.line_count + cost.line_count,
      uncosted_lines: prev.uncosted_lines + cost.uncosted_lines,
      partial_lines: prev.partial_lines + cost.partial_lines,
      status: worseStatus(prev.status, cost.status),
      pi_bills: mergePiBills([...prev.pi_bills, ...cost.pi_bills]),
    });
  }
  return [...map.values()].sort((a, b) => a.billno.localeCompare(b.billno));
}

export function indexBillFifo(costs: BillFifoCost[]): Map<string, BillFifoCost> {
  return new Map(costs.map((cost) => [cost.billno, cost]));
}

export function fifoMargin(input: {
  revenue: number;
  billnos: string[];
  costs: BillFifoCost[];
}): FifoMargin {
  const expected = [...new Set(input.billnos.map((bill) => bill.trim()).filter(Boolean))];
  const byBill = indexBillFifo(input.costs);
  let fifo = 0;
  let costed = 0;
  let missing = 0;
  let uncosted = 0;
  let partial = 0;
  const pi: FifoPiBill[] = [];
  for (const billno of expected) {
    const row = byBill.get(billno);
    if (!row) {
      missing += 1;
      continue;
    }
    fifo += row.fifo_ext_cost;
    costed += 1;
    pi.push(...row.pi_bills);
    if (row.status === "UNCOSTED") uncosted += 1;
    else if (row.status === "PARTIAL") partial += 1;
  }
  const revenue = roundMoney(input.revenue);
  const fifoExt = roundMoney(fifo);
  const profit = roundMoney(revenue - fifoExt);
  let status: FifoMarginStatus;
  if (expected.length === 0 || missing === expected.length) status = "MISSING";
  else if (missing === 0 && partial === 0 && uncosted === costed) status = "UNCOSTED";
  else if (missing > 0 || partial > 0 || uncosted > 0) status = "PARTIAL";
  else status = "OK";
  return {
    revenue,
    fifo_ext_cost: fifoExt,
    profit,
    margin_pct: revenue === 0 ? null : roundMoney((profit / revenue) * 100),
    status,
    pi_bills: mergePiBills(pi),
    costed_bills: costed,
    expected_bills: expected.length,
  };
}

export function briefFifoMargin(margin: FifoMargin): FifoMarginBrief {
  return {
    revenue: margin.revenue,
    fifo_ext_cost: margin.fifo_ext_cost,
    profit: margin.profit,
    margin_pct: margin.margin_pct,
    status: margin.status,
    costed_bills: margin.costed_bills,
    expected_bills: margin.expected_bills,
    pi_bill_count: new Set(margin.pi_bills.map((bill) => bill.pi_billno)).size,
  };
}

export function piBillRefs(bills: FifoPiBill[], limit = 8): string {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const bill of bills) {
    if (!bill.pi_billno || seen.has(bill.pi_billno)) continue;
    seen.add(bill.pi_billno);
    names.push(bill.pi_billno);
  }
  if (names.length === 0) return "";
  const shown = names.slice(0, limit);
  const extra = names.length - shown.length;
  return extra > 0 ? `${shown.join(", ")} +${extra}` : shown.join(", ");
}

const money = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function fifoMarginText(
  margin: Pick<
    FifoMargin,
    "status" | "fifo_ext_cost" | "profit" | "margin_pct" | "costed_bills" | "expected_bills"
  >
): string | null {
  if (margin.expected_bills === 0) return null;
  if (margin.status === "MISSING") return "ยังไม่มีต้นทุน FIFO";
  if (margin.status === "UNCOSTED") return "ยังคิดต้นทุน FIFO ไม่ได้";
  const pct = margin.margin_pct == null ? "" : ` (${margin.margin_pct.toFixed(1)}%)`;
  const incomplete =
    margin.status === "OK" ? "" : ` · ต้นทุนยังไม่ครบ ${margin.costed_bills}/${margin.expected_bills}`;
  return `ต้นทุน FIFO ${money.format(margin.fifo_ext_cost)} · กำไร ${money.format(margin.profit)}${pct}${incomplete}`;
}
