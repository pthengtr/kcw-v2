import {
  asNumber,
  asString,
  isRecord,
  paymentCashList,
  paymentChangeList,
  paymentObject,
} from "@/lib/bank/tiger-pay-format";
import type { TigerPayTransaction } from "@/lib/bank/tiger-pay-types";

export const TIGER_PAY_DENOMS = [1000, 500, 100, 50, 20, 10, 5, 2, 1] as const;

export type TigerPayChangeLevel = "green" | "orange" | "red";

export type TigerPayDailyBill = {
  tigerPaymentId: number;
  paymentNo: string;
  paymentType: string;
  status: string;
  amount: number;
  posAmount: number | null;
  cashFloorRemainder: number;
  totalPay: number;
  changeAmount: number;
  posBillNumber: string | null;
  submittedByName: string | null;
  at: string | null;
};

export type TigerPayDailyFloor = {
  posBillNumber: string | null;
  paymentNo: string;
  posAmount: number;
  tigerAmount: number;
  remainder: number;
};

type DailyAttempt = {
  tiger_payment_id: number | null;
  pos_bill_number: string | null;
  submitted_by_name: string | null;
  created_at?: string | null;
  amount?: number | string | null;
};

type DailyVoucher = {
  id?: string | null;
  pos_bill_number?: string | null;
  voucher_num?: string | null;
  amount: number | string | null;
  status: string | null;
  raw_status?: string | null;
  raw_last_show?: unknown;
  submitted_by_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type VoucherCashDirection = "out" | "none";

export type TigerPayDailyVoucher = {
  id: string;
  posBillNumber: string | null;
  voucherNum: string | null;
  status: string;
  amount: number;
  /** Baht the cashbox paid out (CN redeem). Cancelled / unused codes are 0. */
  cashMoved: number;
  cashDirection: VoucherCashDirection;
  submittedByName: string | null;
  at: string | null;
  superseded: boolean;
};

export type TigerPayDailyException = {
  paymentNo: string;
  status: string;
  paymentType: string;
  totalPay: number;
  changeAmount: number;
  remark: string | null;
};

export type TigerPayDailyRollup = {
  date: string;
  billed: number;
  billedNet: number;
  posBilled: number;
  cashFloorRemainder: number;
  flooredBills: TigerPayDailyFloor[];
  cashIn: number;
  changeOut: number;
  cashNet: number;
  qrPromptpayIn: number;
  successCount: number;
  cancelCount: number;
  failCount: number;
  pendingCount: number;
  otherCount: number;
  changeBillCount: number;
  unspecifiedIn: number;
  denomIn: Record<string, number>;
  denomOut: Record<string, number>;
  methodMix: { key: string; count: number; baht: number }[];
  hourly: { hour: number; billed: number; count: number }[];
  bills: TigerPayDailyBill[];
  exceptions: TigerPayDailyException[];
  vouchers: TigerPayDailyVoucher[];
  voucherUsedCount: number;
  voucherUsedAmount: number;
  voucherCancelledCount: number;
  voucherPendingCount: number;
};

export type TigerPayCashSnapshot = {
  id: string;
  captured_at: string;
  biz_day: string;
  trigger: string;
  change_ready: boolean | null;
  change_level: TigerPayChangeLevel;
  change_reasons: string[];
  items: Array<{ type?: string; value: number; amount: number }>;
  total_baht: number;
  shop_code: string;
};

export type TigerPayDailyClose = {
  biz_day: string;
  shop_code: string;
  closed_at: string;
  trigger: string;
  report: Record<string, unknown>;
  locked: boolean;
};

const bangkokDayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const bangkokHourFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bangkok",
  hour: "2-digit",
  hourCycle: "h23",
});

export function bangkokDayOf(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return null;
  return bangkokDayFmt.format(dt);
}

export function bizDayOf(row: {
  tiger_created_at?: string | null;
  last_received_at?: string | null;
  created_at?: string | null;
}): string | null {
  return (
    bangkokDayOf(row.tiger_created_at) ||
    bangkokDayOf(row.last_received_at) ||
    bangkokDayOf(row.created_at)
  );
}

export function addIsoDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

function money(value: unknown): number {
  const n = asNumber(value);
  return n == null ? 0 : n;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function attemptPosAmount(attempt: DailyAttempt | undefined): number | null {
  if (!attempt) return null;
  return asNumber(attempt.amount);
}

function isVoucherUsedStatus(status: string): boolean {
  return status === "used" || status === "success";
}

function isVoucherCancelledStatus(status: string): boolean {
  return status === "cancel" || status === "cancelled";
}

function voucherShowRecord(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  if (isRecord(raw.voucher)) return raw.voucher;
  return raw;
}

function isCancelledVoucher(row: {
  status: string;
  raw_status?: string | null;
  raw_last_show?: unknown;
}): boolean {
  const show = voucherShowRecord(row.raw_last_show);
  const note = (asString(show?.note) ?? "").trim().toLowerCase();
  const rawStatus = (row.raw_status ?? "").trim().toLowerCase();
  return (
    isVoucherCancelledStatus(row.status) ||
    isVoucherCancelledStatus(note) ||
    isVoucherCancelledStatus(rawStatus)
  );
}

/**
 * Cash the cashbox actually moved for a voucher QR.
 * Redeem: used=1 and balance=0, note is not cancelled → cash OUT.
 * Cancel always means the code was voided before redeem — no cash in or out,
 * even when Tiger later shows used=1 with note=cancelled.
 */
export function classifyVoucherCash(row: {
  amount: number;
  status: string;
  raw_status?: string | null;
  raw_last_show?: unknown;
}): { direction: VoucherCashDirection; amount: number } {
  const amount = row.amount > 0 ? row.amount : 0;
  const show = voucherShowRecord(row.raw_last_show);
  const usedFlag = show ? asNumber(show.used) : null;
  const balance = show ? asNumber(show.balance) : null;
  if (isCancelledVoucher(row)) {
    return { direction: "none", amount: 0 };
  }
  if (show) {
    return usedFlag === 1 && balance === 0 && amount > 0
      ? { direction: "out", amount }
      : { direction: "none", amount: 0 };
  }
  if (isVoucherUsedStatus(row.status) && amount > 0) {
    return { direction: "out", amount };
  }
  return { direction: "none", amount: 0 };
}

/** Cash the cashbox paid for this QR. Cancelled codes (used=1 but note=cancelled) are 0. */
export function voucherCashMoved(row: {
  amount: number;
  status: string;
  raw_status?: string | null;
  raw_last_show?: unknown;
}): number {
  const move = classifyVoucherCash(row);
  return move.direction === "out" ? move.amount : 0;
}

/** Cancelled codes on a bill that later paid out are history, not a second cash move. */
export function markSupersededVouchers(
  rows: TigerPayDailyVoucher[]
): TigerPayDailyVoucher[] {
  const paidBills = new Set(
    rows
      .filter((row) => row.cashMoved > 0 && row.posBillNumber)
      .map((row) => row.posBillNumber as string)
  );
  return rows.map((row) => ({
    ...row,
    superseded: Boolean(
      row.posBillNumber &&
        paidBills.has(row.posBillNumber) &&
        row.cashMoved === 0 &&
        isVoucherCancelledStatus(row.status)
    ),
  }));
}

function bump(map: Record<string, number>, key: string, by: number) {
  map[key] = (map[key] ?? 0) + by;
}

export function emptyDenomMap(): Record<string, number> {
  return Object.fromEntries(TIGER_PAY_DENOMS.map((d) => [String(d), 0]));
}

export function rollupTigerPayDay(input: {
  date: string;
  shopCode: string;
  transactions: TigerPayTransaction[];
  attempts?: DailyAttempt[];
  vouchers?: DailyVoucher[];
}): TigerPayDailyRollup {
  const rows = input.transactions.filter((row) => {
    if (input.shopCode && row.shop_code && row.shop_code !== input.shopCode) {
      return false;
    }
    return bizDayOf(row) === input.date;
  });

  const attemptByPayment = new Map<number, DailyAttempt>();
  for (const attempt of input.attempts ?? []) {
    if (attempt.tiger_payment_id == null) continue;
    if (!attemptByPayment.has(attempt.tiger_payment_id)) {
      attemptByPayment.set(attempt.tiger_payment_id, attempt);
    }
  }

  const denomIn = emptyDenomMap();
  const denomOut = emptyDenomMap();
  const methodMap = new Map<string, { count: number; baht: number }>();
  const hourly = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    billed: 0,
    count: 0,
  }));
  const bills: TigerPayDailyBill[] = [];
  const exceptions: TigerPayDailyException[] = [];
  const flooredBills: TigerPayDailyFloor[] = [];

  let billed = 0;
  let posBilled = 0;
  let cashFloorRemainder = 0;
  let cashIn = 0;
  let changeOut = 0;
  let qrPromptpayIn = 0;
  let successCount = 0;
  let cancelCount = 0;
  let failCount = 0;
  let pendingCount = 0;
  let otherCount = 0;
  let changeBillCount = 0;
  let unspecifiedIn = 0;

  for (const row of rows) {
    const status = (row.status ?? "").trim().toLowerCase();
    const paymentType = (row.payment_type ?? "").trim().toLowerCase();
    const amount = money(row.amount);
    const totalPay = money(row.total_pay);
    const changeAmount = money(row.change_amount);
    const attempt = attemptByPayment.get(row.tiger_payment_id);
    const posAmount = attemptPosAmount(attempt);
    const payment = paymentObject(row.payload);
    const inserted = paymentCashList(payment);
    const changePieces = paymentChangeList(payment);
    const listedIn = inserted.reduce((sum, piece) => sum + piece.value * piece.amount, 0);
    let billFloorRemainder = 0;

    if (status === "success") successCount += 1;
    else if (status === "cancel" || status === "cancelled") cancelCount += 1;
    else if (status === "fail" || status === "failed") failCount += 1;
    else if (status === "pending" || status === "pendingapproval" || status === "change") {
      pendingCount += 1;
    } else otherCount += 1;

    if (status === "success") {
      billed += amount;
      posBilled += posAmount ?? amount;
      if (paymentType === "cash" && posAmount != null) {
        const remainder = roundMoney(posAmount - amount);
        if (remainder > 0.0001) {
          billFloorRemainder = remainder;
          cashFloorRemainder = roundMoney(cashFloorRemainder + remainder);
          flooredBills.push({
            posBillNumber: attempt?.pos_bill_number ?? null,
            paymentNo: row.payment_no,
            posAmount,
            tigerAmount: amount,
            remainder,
          });
        }
      }
      const mix = methodMap.get(paymentType) ?? { count: 0, baht: 0 };
      mix.count += 1;
      mix.baht += amount;
      methodMap.set(paymentType, mix);
      const at = row.tiger_created_at || row.last_received_at;
      if (at) {
        const hour = Number(bangkokHourFmt.format(new Date(at)));
        if (Number.isFinite(hour) && hourly[hour]) {
          hourly[hour].billed += amount;
          hourly[hour].count += 1;
        }
      }
      if (paymentType === "cash") {
        cashIn += totalPay;
        changeOut += changeAmount;
        if (changeAmount > 0) changeBillCount += 1;
        for (const piece of inserted) bump(denomIn, String(piece.value), piece.amount);
        const gap = totalPay - listedIn;
        if (gap > 0.009) unspecifiedIn += gap;
        for (const piece of changePieces) bump(denomOut, String(piece.value), piece.amount);
      } else if (paymentType === "qr" || paymentType === "promptpay") {
        qrPromptpayIn += totalPay;
      }
    } else if (inserted.length > 0 || changePieces.length > 0 || changeAmount > 0) {
      exceptions.push({
        paymentNo: row.payment_no,
        status,
        paymentType,
        totalPay,
        changeAmount,
        remark: row.remark,
      });
      for (const piece of inserted) bump(denomIn, String(piece.value), piece.amount);
      for (const piece of changePieces) bump(denomOut, String(piece.value), piece.amount);
    }

    if (status === "success" && paymentType === "cash" && inserted.length === 0 && totalPay > 0) {
      exceptions.push({
        paymentNo: row.payment_no,
        status,
        paymentType,
        totalPay,
        changeAmount,
        remark: "ไม่ระบุใบ (cashList ว่าง)",
      });
    }

    bills.push({
      tigerPaymentId: row.tiger_payment_id,
      paymentNo: row.payment_no,
      paymentType,
      status,
      amount,
      posAmount,
      cashFloorRemainder: billFloorRemainder,
      totalPay,
      changeAmount,
      posBillNumber: attempt?.pos_bill_number ?? null,
      submittedByName: attempt?.submitted_by_name ?? null,
      at: row.tiger_created_at || row.last_received_at,
    });
  }

  const vouchersForDay = (input.vouchers ?? []).filter((row) => {
    return (
      bizDayOf({ created_at: row.created_at ?? null }) === input.date ||
      bizDayOf({ created_at: row.updated_at ?? null }) === input.date
    );
  });
  const voucherRows: TigerPayDailyVoucher[] = markSupersededVouchers(
    vouchersForDay.map((row, index) => {
      const status = (row.status ?? "").trim().toLowerCase() || "unknown";
      const amount = money(row.amount);
      const move = classifyVoucherCash({
        amount,
        status,
        raw_status: row.raw_status,
        raw_last_show: row.raw_last_show,
      });
      return {
        id: row.id ?? `voucher-${index}`,
        posBillNumber: row.pos_bill_number ?? null,
        voucherNum: row.voucher_num ?? null,
        status,
        amount,
        cashMoved: move.direction === "out" ? move.amount : 0,
        cashDirection: move.direction,
        submittedByName: row.submitted_by_name ?? null,
        at: row.updated_at || row.created_at || null,
        superseded: false,
      };
    })
  );
  const voucherUsed = voucherRows.filter((row) => row.cashMoved > 0);
  const voucherPending = voucherRows.filter((row) => row.status === "pending");
  const voucherCancelled = voucherRows.filter(
    (row) => isVoucherCancelledStatus(row.status) && !row.superseded
  );
  const voucherUsedAmount = roundMoney(
    voucherUsed.reduce((sum, row) => sum + row.cashMoved, 0)
  );
  // Cashbox confirmed in (success payments) minus cashbox confirmed CN out.
  // Cancelled CN is always pre-redeem — never cash in.
  const billedNet = roundMoney(billed - voucherUsedAmount);
  const cashNet = roundMoney(cashIn - changeOut - voucherUsedAmount);

  return {
    date: input.date,
    billed,
    billedNet,
    posBilled,
    cashFloorRemainder,
    flooredBills,
    cashIn,
    changeOut,
    cashNet,
    qrPromptpayIn,
    successCount,
    cancelCount,
    failCount,
    pendingCount,
    otherCount,
    changeBillCount,
    unspecifiedIn,
    denomIn,
    denomOut,
    methodMix: [...methodMap.entries()].map(([key, value]) => ({
      key,
      ...value,
    })),
    hourly,
    bills: bills.sort((a, b) => (b.at ?? "").localeCompare(a.at ?? "")),
    exceptions,
    vouchers: voucherRows.sort((a, b) => (b.at ?? "").localeCompare(a.at ?? "")),
    voucherUsedCount: voucherUsed.length,
    voucherUsedAmount,
    voucherCancelledCount: voucherCancelled.length,
    voucherPendingCount: voucherPending.length,
  };
}

export function hopperItemCounts(
  items: TigerPayCashSnapshot["items"] | null | undefined
): Record<string, number> {
  const counts = emptyDenomMap();
  for (const item of items ?? []) {
    const value = asNumber(item.value);
    const amount = asNumber(item.amount);
    if (value == null || amount == null) continue;
    bump(counts, String(value), amount);
  }
  return counts;
}

export function mapCashSnapshot(row: unknown): TigerPayCashSnapshot | null {
  if (!isRecord(row)) return null;
  const id = asString(row.id);
  const capturedAt = asString(row.captured_at);
  if (!id || !capturedAt) return null;
  const levelRaw = (asString(row.change_level) ?? "green").toLowerCase();
  const changeLevel: TigerPayChangeLevel =
    levelRaw === "red" || levelRaw === "orange" ? levelRaw : "green";
  const items = Array.isArray(row.items)
    ? row.items.flatMap((item) => {
        if (!isRecord(item)) return [];
        const value = asNumber(item.value);
        const amount = asNumber(item.amount);
        if (value == null || amount == null) return [];
        return [
          {
            type: asString(item.type) ?? undefined,
            value,
            amount,
          },
        ];
      })
    : [];
  const reasons = Array.isArray(row.change_reasons)
    ? row.change_reasons.map((reason) => String(reason))
    : [];
  return {
    id,
    captured_at: capturedAt,
    biz_day: asString(row.biz_day) ?? "",
    trigger: asString(row.trigger) ?? "",
    change_ready: typeof row.change_ready === "boolean" ? row.change_ready : null,
    change_level: changeLevel,
    change_reasons: reasons,
    items,
    total_baht: asNumber(row.total_baht) ?? 0,
    shop_code: asString(row.shop_code) ?? "1",
  };
}

export function mapDailyClose(row: unknown): TigerPayDailyClose | null {
  if (!isRecord(row)) return null;
  const bizDay = asString(row.biz_day);
  const shopCode = asString(row.shop_code);
  const closedAt = asString(row.closed_at);
  if (!bizDay || !shopCode || !closedAt) return null;
  return {
    biz_day: bizDay,
    shop_code: shopCode,
    closed_at: closedAt,
    trigger: asString(row.trigger) ?? "",
    report: isRecord(row.report) ? row.report : {},
    locked: Boolean(row.locked),
  };
}

export function countMap(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value)) {
    const n = asNumber(raw);
    if (n == null) continue;
    out[key] = n;
  }
  return out;
}
