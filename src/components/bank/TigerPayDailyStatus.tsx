"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import SalesKpiCard from "@/components/bi/sales/SalesKpiCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatBaht as formatBahtBi,
  formatCount,
  pctChange,
} from "@/lib/bi/sales-format";
import { bangkokTodayIso } from "@/lib/bi/sales-periods";
import {
  formatBaht,
  formatBangkokDateTime,
  formatPaymentType,
} from "@/lib/bank/tiger-pay-format";
import {
  TIGER_PAY_DENOMS,
  countMap,
  hopperItemCounts,
  type TigerPayCashSnapshot,
  type TigerPayDailyClose,
  type TigerPayDailyRollup,
} from "@/lib/bank/tiger-pay-daily";
import { TigerPayStatusBadge } from "@/components/bank/TigerPayStatusBadge";
import TigerPayTransactionDetail from "@/components/bank/TigerPayTransactionDetail";
import type { TigerPayTransaction } from "@/lib/bank/tiger-pay-types";
import { cn } from "@/lib/utils";

const WATCH_DENOMS = new Set([100, 50, 20, 10, 5, 1]);

type DailyResponse = {
  date: string;
  shop: string;
  today: TigerPayDailyRollup;
  previous: TigerPayDailyRollup;
  hopper: TigerPayCashSnapshot | null;
  dailyClose: TigerPayDailyClose | null;
};

type ListRow = Omit<TigerPayTransaction, "payload">;

function ZReportPanel({ close }: { close: TigerPayDailyClose }) {
  const report = close.report;
  const opening = countMap(report.hopper_opening);
  const expected = countMap(report.hopper_expected);
  const actual = countMap(report.hopper_actual);
  const variance = countMap(report.variance);
  const denoms = TIGER_PAY_DENOMS.filter(
    (denom) =>
      (opening[String(denom)] ?? 0) ||
      (expected[String(denom)] ?? 0) ||
      (actual[String(denom)] ?? 0) ||
      (variance[String(denom)] ?? 0) ||
      denom >= 20
  );

  return (
    <section className="rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-sm font-semibold">Z-report ที่ปิดแล้ว</div>
        <Badge variant="secondary">
          {formatBangkokDateTime(close.closed_at)} · {close.trigger}
        </Badge>
      </div>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>ยอดสำเร็จ {formatBahtBi(Number(report.billed ?? 0), true)}</div>
        <div>รับเข้า {formatBahtBi(Number(report.cash_in ?? 0), true)}</div>
        <div>ทอน {formatBahtBi(Number(report.change_out ?? 0), true)}</div>
        <div>สุทธิ {formatBahtBi(Number(report.cash_net ?? 0), true)}</div>
      </div>
      {Number(report.unspecified_in ?? 0) > 0 ? (
        <p className="mt-2 text-sm text-amber-800">
          ไม่ระบุใบ {formatBahtBi(Number(report.unspecified_in), true)} — ไม่นับ variance รายใบสำหรับยอดนี้
        </p>
      ) : null}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 pr-3">มูลค่า</th>
              <th className="py-1 pr-3 text-right">เปิดวัน</th>
              <th className="py-1 pr-3 text-right">คาดจากบิล</th>
              <th className="py-1 pr-3 text-right">hopper จริง</th>
              <th className="py-1 text-right">ผลต่าง</th>
            </tr>
          </thead>
          <tbody>
            {denoms.map((denom) => {
              const key = String(denom);
              const diff = variance[key] ?? 0;
              return (
                <tr key={denom} className="border-t">
                  <td className="py-1.5 pr-3">฿{denom}</td>
                  <td className="py-1.5 pr-3 text-right">{opening[key] ?? 0}</td>
                  <td className="py-1.5 pr-3 text-right">{expected[key] ?? 0}</td>
                  <td className="py-1.5 pr-3 text-right">{actual[key] ?? 0}</td>
                  <td
                    className={cn(
                      "py-1.5 text-right",
                      diff !== 0 && "font-medium text-amber-800"
                    )}
                  >
                    {diff}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function TigerPayDailyStatus({
  refreshToken,
  shop = "1",
  onHopperChange,
  hopperRefreshing,
  onCloseDay,
}: {
  refreshToken: number;
  shop?: string;
  onHopperChange?: (hopper: TigerPayCashSnapshot | null) => void;
  hopperRefreshing?: boolean;
  onCloseDay?: (date: string) => Promise<void> | void;
}) {
  const hopperCb = useRef(onHopperChange);
  hopperCb.current = onHopperChange;

  const [date, setDate] = useState(() => bangkokTodayIso());
  const [data, setData] = useState<DailyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ListRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ date, shop });
        const res = await fetch(`/api/bank/tiger-pay/daily?${params}`, {
          cache: "no-store",
          signal,
        });
        if (!res.ok) throw new Error("load failed");
        const json = (await res.json()) as DailyResponse;
        setData(json);
        hopperCb.current?.(json.hopper);
      } catch (e) {
        if (String(e).includes("AbortError")) return;
        setError("โหลดสรุปรายวันไม่สำเร็จ");
        setData(null);
        hopperCb.current?.(null);
      } finally {
        setLoading(false);
      }
    },
    [date, shop]
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, refreshToken]);

  const today = data?.today;
  const previous = data?.previous;
  const hopperCounts = hopperItemCounts(data?.hopper?.items);
  const denomRows = useMemo(() => {
    if (!today) return [];
    return TIGER_PAY_DENOMS.map((denom) => {
      const key = String(denom);
      const inbound = today.denomIn[key] ?? 0;
      const outbound = today.denomOut[key] ?? 0;
      return {
        denom,
        inbound,
        outbound,
        net: inbound - outbound,
        hopper: hopperCounts[key] ?? 0,
      };
    }).filter(
      (row) => row.inbound || row.outbound || row.hopper || row.denom >= 20
    );
  }, [today, hopperCounts]);

  const lateBills =
    today && data?.dailyClose
      ? today.bills.filter(
          (bill) => bill.at && bill.at > data.dailyClose!.closed_at
        )
      : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-xs text-muted-foreground">วันที่ (กรุงเทพฯ)</span>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-[160px]"
          />
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setDate(bangkokTodayIso())}
        >
          วันนี้
        </Button>
        {data?.dailyClose ? (
          <Badge variant="secondary">
            ปิดวันแล้ว {formatBangkokDateTime(data.dailyClose.closed_at)}
          </Badge>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!onCloseDay || hopperRefreshing}
            onClick={() => void onCloseDay?.(date)}
          >
            ปิดวัน (Z-report)
          </Button>
        )}
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      {loading && !today ? (
        <div className="text-sm text-muted-foreground">กำลังโหลด…</div>
      ) : null}

      {today ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <SalesKpiCard
              title="ยอดสุทธิวันนี้"
              value={formatBahtBi(today.billedNet, true)}
              deltaPct={pctChange(today.billedNet, previous?.billedNet ?? 0)}
              hint={`ชำระสำเร็จ ${formatBahtBi(today.billed, true)}${
                today.cashFloorRemainder > 0
                  ? ` · POS ${formatBahtBi(today.posBilled, true)} ปัดลง ${formatBahtBi(today.cashFloorRemainder, true)}`
                  : ""
              }${
                today.voucherUsedAmount > 0
                  ? ` − CN ใช้แล้ว ${formatBahtBi(today.voucherUsedAmount, true)}`
                  : ""
              }`}
            />
            <SalesKpiCard
              title="ปัดลงเงินสด"
              value={formatBahtBi(today.cashFloorRemainder, true)}
              className={
                today.cashFloorRemainder > 0 ? "border-amber-300 bg-amber-50/60" : undefined
              }
              hint={
                today.flooredBills.length > 0
                  ? `${formatCount(today.flooredBills.length)} บิลสตางค์ (ส่วนใหญ่ TR)`
                  : "ไม่มีสตางค์ถูกปัดวันนี้"
              }
            />
            <SalesKpiCard
              title="ยอดชำระสำเร็จ"
              value={formatBahtBi(today.billed, true)}
              deltaPct={pctChange(today.billed, previous?.billed ?? 0)}
              hint={`${formatCount(today.successCount)} บิล${
                today.cashFloorRemainder > 0
                  ? ` · ตามบิล POS ${formatBahtBi(today.posBilled, true)}`
                  : ""
              }`}
            />
            <SalesKpiCard
              title="เงินสดรับเข้า"
              value={formatBahtBi(today.cashIn, true)}
              deltaPct={pctChange(today.cashIn, previous?.cashIn ?? 0)}
              hint={
                today.unspecifiedIn > 0
                  ? `ไม่ระบุใบ ${formatBahtBi(today.unspecifiedIn, true)}`
                  : undefined
              }
            />
            <SalesKpiCard
              title="เงินทอน"
              value={formatBahtBi(today.changeOut, true)}
              hint={`${formatCount(today.changeBillCount)} บิลที่ทอน`}
            />
            <SalesKpiCard
              title="เงินสดสุทธิเข้าเครื่อง"
              value={formatBahtBi(today.cashNet, true)}
            />
            <SalesKpiCard
              title="QR / PromptPay"
              value={formatBahtBi(today.qrPromptpayIn, true)}
            />
            <SalesKpiCard
              title="จ่ายคืน CN (redeem)"
              value={formatBahtBi(today.voucherUsedAmount, true)}
              hint={`${formatCount(today.voucherUsedCount)} ใช้แล้ว · หักจากยอดสุทธิ${
                today.voucherCancelledCount
                  ? ` · ยกเลิก ${today.voucherCancelledCount} ไม่ขยับยอด`
                  : ""
              }${
                today.voucherPendingCount
                  ? ` · ค้าง ${today.voucherPendingCount}`
                  : ""
              }`}
            />
            <SalesKpiCard
              title="จำนวนบิล"
              value={formatCount(
                today.successCount +
                  today.cancelCount +
                  today.failCount +
                  today.pendingCount
              )}
              hint={`สำเร็จ ${today.successCount} · ยกเลิก ${today.cancelCount} · ล้มเหลว ${today.failCount} · ค้าง ${today.pendingCount}`}
            />
          </div>

          <section
            className={cn(
              "rounded-md border p-3",
              today.cashFloorRemainder > 0
                ? "border-amber-200 bg-amber-50/40"
                : "border-slate-200"
            )}
          >
            <div className="text-sm font-semibold">
              ปัดลงเงินสด {formatBahtBi(today.cashFloorRemainder, true)}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              เครื่องรับเงินสดเป็นบาทเต็ม บิล VAT เงินสด (TR) ที่มียอดสตางค์ถูกปัดลงตอนส่ง
              Open API — ยอดสุทธิหักเฉพาะ CN ที่จ่ายแล้ว ใบที่ยกเลิกไม่ขยับยอด
            </p>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                ตามบิล POS {formatBahtBi(today.posBilled, true)}
              </div>
              <div>
                ปัดลง {formatBahtBi(today.cashFloorRemainder, true)}
              </div>
              <div>
                ยอดที่เครื่อง {formatBahtBi(today.billed, true)}
              </div>
              <div>
                สุทธิหลัง CN {formatBahtBi(today.posNet, true)}
              </div>
            </div>
            {today.flooredBills.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm">
                {today.flooredBills.map((row) => (
                  <li key={`${row.paymentNo}-${row.posBillNumber ?? ""}`}>
                    {row.posBillNumber ?? row.paymentNo}
                    {row.posBillNumber?.toUpperCase().startsWith("TR")
                      ? " · VAT เงินสด (TR)"
                      : ""}
                    {" · "}
                    {formatBahtBi(row.posAmount, true)} →{" "}
                    {formatBahtBi(row.tigerAmount, true)}
                    {" · ปัดลง "}
                    {formatBahtBi(row.remainder, true)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">ไม่มีบิลที่ถูกปัดลงวันนี้</p>
            )}
          </section>

          {today.methodMix.length > 0 ? (
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              {today.methodMix.map((row) => (
                <Badge key={row.key} variant="outline">
                  {formatPaymentType(row.key)} {formatCount(row.count)} ·{" "}
                  {formatBahtBi(row.baht, true)}
                </Badge>
              ))}
            </div>
          ) : null}

          <section className="rounded-md border overflow-x-auto">
            <div className="border-b px-3 py-2 text-sm font-semibold">
              ใบเงินรับเข้า / ทอนออก / ในเครื่อง
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="px-3 py-2">มูลค่า</th>
                  <th className="px-3 py-2 text-right">รับเข้า</th>
                  <th className="px-3 py-2 text-right">ทอนออก</th>
                  <th className="px-3 py-2 text-right">สุทธิจากบิล</th>
                  <th className="px-3 py-2 text-right">hopper ล่าสุด</th>
                </tr>
              </thead>
              <tbody>
                {denomRows.map((row) => (
                  <tr key={row.denom} className="border-t">
                    <td className="px-3 py-1.5">฿{row.denom}</td>
                    <td className="px-3 py-1.5 text-right">{row.inbound}</td>
                    <td className="px-3 py-1.5 text-right">{row.outbound}</td>
                    <td className="px-3 py-1.5 text-right">{row.net}</td>
                    <td
                      className={cn(
                        "px-3 py-1.5 text-right",
                        WATCH_DENOMS.has(row.denom) &&
                          row.hopper <= 10 &&
                          "font-medium text-amber-800",
                        WATCH_DENOMS.has(row.denom) &&
                          row.hopper <= 2 &&
                          "text-rose-700"
                      )}
                    >
                      {row.hopper}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="rounded-md border p-3">
            <div className="text-sm font-semibold">รายชั่วโมง</div>
            <div className="mt-2 grid grid-cols-6 gap-1 sm:grid-cols-12">
              {today.hourly.map((row) => (
                <div
                  key={row.hour}
                  className="rounded bg-slate-50 px-1 py-1 text-center"
                >
                  <div className="text-[10px] text-muted-foreground">
                    {String(row.hour).padStart(2, "0")}
                  </div>
                  <div className="text-xs font-medium">{row.count || "—"}</div>
                </div>
              ))}
            </div>
          </section>

          {today.exceptions.length > 0 ? (
            <section className="rounded-md border border-amber-200 bg-amber-50/40 p-3">
              <div className="text-sm font-semibold">
                รายการที่ขยับเงินสดผิดปกติ
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {today.exceptions.map((row) => (
                  <li key={`${row.paymentNo}-${row.status}-${row.remark ?? ""}`}>
                    {row.paymentNo} · {row.status} ·{" "}
                    {formatPaymentType(row.paymentType)} ·{" "}
                    {formatBaht(row.totalPay)} / ทอน {formatBaht(row.changeAmount)}
                    {row.remark ? ` · ${row.remark}` : ""}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {(today.vouchers ?? []).length > 0 ? (
            <section className="rounded-md border overflow-x-auto">
              <div className="border-b px-3 py-2 text-sm font-semibold">
                ใบลดหนี้ / redeem
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="px-3 py-2">สถานะ</th>
                    <th className="px-3 py-2">เวลา</th>
                    <th className="px-3 py-2">บิล CN</th>
                    <th className="px-3 py-2">Voucher</th>
                    <th className="px-3 py-2 text-right">ยอดจ่ายคืน</th>
                    <th className="px-3 py-2">ผู้ส่ง</th>
                  </tr>
                </thead>
                <tbody>
                  {today.vouchers.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="px-3 py-1.5">
                        {row.status === "used" || row.status === "success"
                          ? "ใช้แล้ว"
                          : row.status === "pending"
                            ? "ค้าง"
                            : row.superseded
                              ? "ยกเลิก (มีใบใหม่)"
                              : row.status === "cancelled" || row.status === "cancel"
                                ? "ยกเลิก"
                                : row.status}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        {formatBangkokDateTime(row.at)}
                      </td>
                      <td className="px-3 py-1.5">{row.posBillNumber ?? "—"}</td>
                      <td className="px-3 py-1.5">{row.voucherNum ?? "—"}</td>
                      <td className="px-3 py-1.5 text-right">{formatBaht(row.amount)}</td>
                      <td className="px-3 py-1.5">{row.submittedByName ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          {data?.dailyClose ? <ZReportPanel close={data.dailyClose} /> : null}

          {lateBills.length > 0 ? (
            <p className="text-sm text-amber-800">
              มีรายการหลังปิดวัน {lateBills.length} บิล — ตัวเลขบนแท็บนี้รวมแล้ว
              แต่ Z-report ที่ปิดไว้ไม่เปลี่ยน
            </p>
          ) : null}

          <section className="rounded-md border overflow-x-auto">
            <div className="border-b px-3 py-2 text-sm font-semibold">บิลวันนี้</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="px-3 py-2">สถานะ</th>
                  <th className="px-3 py-2">เวลา</th>
                  <th className="px-3 py-2">บิล POS</th>
                  <th className="px-3 py-2">Payment</th>
                  <th className="px-3 py-2">ช่องทาง</th>
                  <th className="px-3 py-2 text-right">ยอด</th>
                  <th className="px-3 py-2 text-right">รับ/ทอน</th>
                  <th className="px-3 py-2">ผู้ส่ง</th>
                </tr>
              </thead>
              <tbody>
                {today.bills.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                      ไม่มีรายการวันนี้
                    </td>
                  </tr>
                ) : (
                  today.bills.map((bill) => (
                    <tr
                      key={bill.tigerPaymentId}
                      className="border-t cursor-pointer hover:bg-slate-50"
                      onClick={() => {
                        const at = bill.at ?? "";
                        setSelected({
                          tiger_payment_id: bill.tigerPaymentId,
                          payment_no: bill.paymentNo,
                          payment_type: bill.paymentType,
                          status: bill.status,
                          amount: bill.amount,
                          total_pay: bill.totalPay,
                          change_amount: bill.changeAmount,
                          ref_no_1: null,
                          ref_no_2: null,
                          note: null,
                          remark: null,
                          shop_code: shop,
                          shop_name: null,
                          branch_name: null,
                          tiger_created_at: bill.at,
                          tiger_updated_at: bill.at,
                          first_received_at: at,
                          last_received_at: at,
                          last_event_id: null,
                        });
                        setDetailOpen(true);
                      }}
                    >
                      <td className="px-3 py-1.5">
                        <TigerPayStatusBadge status={bill.status} />
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        {formatBangkokDateTime(bill.at)}
                      </td>
                      <td className="px-3 py-1.5">{bill.posBillNumber ?? "—"}</td>
                      <td className="px-3 py-1.5">{bill.paymentNo}</td>
                      <td className="px-3 py-1.5">
                        {formatPaymentType(bill.paymentType)}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {formatBaht(bill.amount)}
                        {bill.cashFloorRemainder > 0 ? (
                          <div className="text-xs text-amber-800">
                            POS {formatBaht(bill.posAmount)} · ปัดลง{" "}
                            {formatBaht(bill.cashFloorRemainder)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {formatBaht(bill.totalPay)} / {formatBaht(bill.changeAmount)}
                      </td>
                      <td className="px-3 py-1.5">{bill.submittedByName ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </>
      ) : null}

      <TigerPayTransactionDetail
        open={detailOpen}
        onOpenChange={setDetailOpen}
        selected={selected}
      />
    </div>
  );
}
