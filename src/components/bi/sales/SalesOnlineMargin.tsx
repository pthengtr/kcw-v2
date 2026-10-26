import { Boxes, Percent, ReceiptText, Wallet } from "lucide-react";

import { formatBaht, formatCount, pctChange } from "@/lib/bi/sales-format";
import { formatThaiPeriodLabel } from "@/lib/bi/sales-periods";
import type {
  BiOnlineMargin,
  BiOnlineMarginSummary,
} from "@/lib/bi/sales-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import SalesKpiCard from "./SalesKpiCard";

const PLATFORM_LABELS: Record<string, string> = {
  lazada: "Lazada",
  shopee: "Shopee",
  tiktok: "TikTok",
  unlinked: "ยังไม่ผูกสเตทเมนต์",
};

const FEE_ROW_LIMIT = 8;

function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] ?? platform;
}

function marginText(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}%`;
}

type SalesOnlineMarginProps = {
  current: BiOnlineMargin;
  previous: BiOnlineMarginSummary;
  mode: "daily" | "monthly";
};

export default function SalesOnlineMargin({
  current,
  previous,
  mode,
}: SalesOnlineMarginProps) {
  const profitDelta = pctChange(current.profit, previous.profit);
  const trend =
    mode === "daily" ? current.trend_daily : current.trend_monthly;
  const feeRows = current.by_fee.filter((row) => row.fee_baht !== 0);
  const visibleFees = feeRows.slice(0, FEE_ROW_LIMIT);
  const otherFee = feeRows
    .slice(FEE_ROW_LIMIT)
    .reduce((sum, row) => sum + row.fee_baht, 0);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-slate-900">
          ออนไลน์ — ค่าธรรมเนียมและต้นทุน FIFO
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          ยอดก่อน VAT หักค่าธรรมเนียมที่ผูกกับบิล และต้นทุน FIFO รายวัน
          {current.fee_bill_count < current.bill_count
            ? ` · ผูกค่าธรรมเนียมแล้ว ${formatCount(current.fee_bill_count)} จาก ${formatCount(current.bill_count)} บิล`
            : null}
          {current.fifo_partial_bill_count > 0
            ? ` · ต้นทุนยังไม่ครบ ${formatCount(current.fifo_partial_bill_count)} บิล`
            : null}
          {current.fifo_missing_bill_count > 0
            ? ` · ยังไม่มี FIFO ${formatCount(current.fifo_missing_bill_count)} บิล`
            : null}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SalesKpiCard
          title="ยอดขายออนไลน์"
          value={formatBaht(current.revenue_net)}
          hint="ก่อน VAT"
          icon={<Wallet className="h-4 w-4" />}
        />
        <SalesKpiCard
          title="ค่าธรรมเนียม"
          value={formatBaht(current.fee_baht)}
          hint={`ช่วงก่อน ${formatBaht(previous.fee_baht)}`}
          icon={<ReceiptText className="h-4 w-4" />}
        />
        <SalesKpiCard
          title="ต้นทุน FIFO"
          value={formatBaht(current.fifo_ext_cost)}
          hint={`${formatCount(current.fifo_bill_count)}/${formatCount(current.bill_count)} บิลมีต้นทุน · ช่วงก่อน ${formatBaht(previous.fifo_ext_cost)}`}
          icon={<Boxes className="h-4 w-4" />}
        />
        <SalesKpiCard
          title="กำไรหลังหักทั้งสอง"
          value={formatBaht(current.profit)}
          deltaPct={profitDelta}
          hint={`อัตรากำไร ${marginText(current.margin_pct)}`}
          icon={<Percent className="h-4 w-4" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              แยกตามแพลตฟอร์ม
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">แพลตฟอร์ม</th>
                  <th className="py-2 pr-3 text-right font-medium">ยอดขาย</th>
                  <th className="py-2 pr-3 text-right font-medium">ค่าธรรมเนียม</th>
                  <th className="py-2 pr-3 text-right font-medium">FIFO</th>
                  <th className="py-2 pr-3 text-right font-medium">กำไร</th>
                  <th className="py-2 text-right font-medium">บิล</th>
                </tr>
              </thead>
              <tbody>
                {current.by_platform.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      ไม่มีบิลออนไลน์
                    </td>
                  </tr>
                ) : (
                  current.by_platform.map((row) => (
                    <tr
                      key={row.platform}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="py-2.5 pr-3 font-medium text-slate-800">
                        {platformLabel(row.platform)}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {formatBaht(row.revenue_net)}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {formatBaht(row.fee_baht)}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {formatBaht(row.fifo_ext_cost)}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {formatBaht(row.profit)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        {formatCount(row.bill_count)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              ค่าธรรมเนียมตามรายการ
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[20rem] text-left text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">รายการ</th>
                  <th className="py-2 text-right font-medium">จำนวนเงิน</th>
                </tr>
              </thead>
              <tbody>
                {visibleFees.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-8 text-center text-muted-foreground">
                      ยังไม่มีค่าธรรมเนียมที่ผูกกับบิลในช่วงนี้
                    </td>
                  </tr>
                ) : (
                  <>
                    {visibleFees.map((row) => (
                      <tr
                        key={row.fee_name}
                        className="border-b border-slate-100 last:border-0"
                      >
                        <td className="py-2.5 pr-3 text-slate-800">{row.fee_name}</td>
                        <td className="py-2.5 text-right tabular-nums">
                          {formatBaht(row.fee_baht)}
                        </td>
                      </tr>
                    ))}
                    {otherFee !== 0 ? (
                      <tr>
                        <td className="py-2.5 pr-3 text-slate-800">อื่นๆ</td>
                        <td className="py-2.5 text-right tabular-nums">
                          {formatBaht(otherFee)}
                        </td>
                      </tr>
                    ) : null}
                  </>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            {mode === "daily" ? "กำไรออนไลน์รายวัน" : "กำไรออนไลน์รายเดือน"}
          </CardTitle>
        </CardHeader>
        <CardContent className="max-h-80 overflow-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">ช่วง</th>
                <th className="py-2 pr-3 text-right font-medium">ยอดขาย</th>
                <th className="py-2 pr-3 text-right font-medium">ค่าธรรมเนียม</th>
                <th className="py-2 pr-3 text-right font-medium">FIFO</th>
                <th className="py-2 pr-3 text-right font-medium">กำไร</th>
                <th className="py-2 text-right font-medium">บิล</th>
              </tr>
            </thead>
            <tbody>
              {trend.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    ไม่มีข้อมูล
                  </td>
                </tr>
              ) : (
                trend.map((row) => (
                  <tr
                    key={row.period}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="py-2.5 pr-3 font-medium text-slate-800">
                      {formatThaiPeriodLabel(row.period, mode)}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {formatBaht(row.revenue_net)}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {formatBaht(row.fee_baht)}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {formatBaht(row.fifo_ext_cost)}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {formatBaht(row.profit)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {formatCount(row.bill_count)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </section>
  );
}
