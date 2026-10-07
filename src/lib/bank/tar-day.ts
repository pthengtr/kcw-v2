import {
  isDailyNet3Tar,
  normalizeMatchStatus,
  parseSalesDateFromRefId,
  type StatementLineRow,
} from "@/lib/bank/statement-report-format";

export type TarDaySeries = "hq" | "syp";

export type TarDayLookup = {
  date: string;
  series: TarDaySeries;
  label: string;
};

export type TarDayBill = {
  doc_type: string;
  billno: string;
  amount: number;
};

type TarDayRow = Pick<
  StatementLineRow,
  | "account_no"
  | "match_status"
  | "match_reason"
  | "match_notes"
  | "matched_ref_type"
  | "matched_ref_id"
>;

function isoDate(value: Date): string {
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, "0");
  const d = String(value.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function shortThaiDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

/** Button target for a statement row already matched as a daily TAR payout. */
export function tarDayLookup(row: TarDayRow): TarDayLookup | null {
  const refType = (row.matched_ref_type ?? "").trim().toLowerCase();
  if (refType !== "tar_cntar_net") return null;

  const status = normalizeMatchStatus(row.match_status);
  if (status === "pending" || status === "unmatched" || status === "ignored") {
    return null;
  }

  const salesDate = parseSalesDateFromRefId(row.matched_ref_id);
  if (!salesDate) return null;

  const date = isoDate(salesDate);
  const series: TarDaySeries = isDailyNet3Tar(row) ? "syp" : "hq";
  const kind = series === "syp" ? "3TAR/3CNTAR" : "TAR/CNTAR";
  return {
    date,
    series,
    label: `ดูบิล ${kind} วันที่ ${shortThaiDay(date)}`,
  };
}

export function summarizeTarDayBills(bills: TarDayBill[]): {
  tar_total: number;
  cntar_total: number;
  net: number;
} {
  let tar = 0;
  let cntar = 0;
  for (const bill of bills) {
    const amount = Number(bill.amount);
    if (!Number.isFinite(amount)) continue;
    if (bill.doc_type === "TAR" || bill.doc_type === "3TAR") tar += amount;
    else if (bill.doc_type === "CNTAR" || bill.doc_type === "3CNTAR") cntar += amount;
  }
  return { tar_total: tar, cntar_total: cntar, net: tar + cntar };
}
