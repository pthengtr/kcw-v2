"use client";

import type { ReactNode } from "react";
import {
  ArrowRight,
  Ban,
  Clock3,
  Coins,
  Info,
  QrCode,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  formatReportBaht,
  tigerPayReportChartRows,
  TIGER_PAY_REPORT_NOTES,
} from "@/lib/bank/tiger-pay-report";
import { formatCount } from "@/lib/bi/sales-format";
import type { TigerPayDailyRollup } from "@/lib/bank/tiger-pay-daily";
import { Button } from "@/components/ui/button";
import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type FormulaTone = "cash" | "qr" | "out" | "cn" | "net";

const TONE: Record<
  FormulaTone,
  { card: string; iconWrap: string; icon: string; amount: string }
> = {
  cash: {
    card: "border-emerald-100 bg-emerald-50/90",
    iconWrap: "bg-emerald-100 text-emerald-600",
    icon: "text-emerald-600",
    amount: "text-emerald-600",
  },
  qr: {
    card: "border-sky-100 bg-sky-50/90",
    iconWrap: "bg-sky-100 text-blue-600",
    icon: "text-blue-600",
    amount: "text-blue-600",
  },
  out: {
    card: "border-rose-100 bg-rose-50/90",
    iconWrap: "bg-rose-100 text-rose-500",
    icon: "text-rose-500",
    amount: "text-rose-500",
  },
  cn: {
    card: "border-violet-100 bg-violet-50/90",
    iconWrap: "bg-violet-100 text-violet-600",
    icon: "text-violet-600",
    amount: "text-violet-600",
  },
  net: {
    card: "border-amber-100 bg-amber-50/90",
    iconWrap: "bg-amber-100 text-amber-600",
    icon: "text-amber-600",
    amount: "text-amber-600",
  },
};

function FormulaCard({
  tone,
  icon,
  title,
  amount,
  count,
  hint,
}: {
  tone: FormulaTone;
  icon: ReactNode;
  title: string;
  amount: number;
  count?: number;
  hint: string;
}) {
  const colors = TONE[tone];
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-start gap-3 rounded-2xl border px-4 py-3.5 shadow-sm",
        colors.card
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          colors.iconWrap
        )}
        aria-hidden
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-slate-500">{title}</div>
        <div
          className={cn(
            "mt-0.5 text-xl font-semibold tracking-tight sm:text-2xl",
            colors.amount
          )}
        >
          {formatReportBaht(amount)}
        </div>
        {count != null ? (
          <div className="mt-0.5 text-xs text-slate-500">
            {formatCount(count)} บิล
          </div>
        ) : null}
        <p className="mt-1 text-[11px] leading-snug text-slate-400">{hint}</p>
      </div>
    </div>
  );
}

function Operator({ children }: { children: string }) {
  return (
    <div
      className="hidden shrink-0 items-center justify-center self-center text-2xl font-light text-slate-300 xl:flex xl:px-1"
      aria-hidden
    >
      {children}
    </div>
  );
}

function ChartBarLabel({
  x,
  y,
  width,
  value,
}: {
  x?: number;
  y?: number;
  width?: number;
  value?: number;
}) {
  if (x == null || y == null || width == null || value == null) return null;
  return (
    <text
      x={x + width / 2}
      y={y - 8}
      textAnchor="middle"
      className="fill-slate-600 text-[11px] font-medium"
    >
      {formatReportBaht(value, false)}
    </text>
  );
}

function CountRow({
  icon,
  iconClass,
  label,
  count,
}: {
  icon: ReactNode;
  iconClass: string;
  label: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          iconClass
        )}
        aria-hidden
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1 text-sm text-slate-700">{label}</div>
      <div className="shrink-0 text-right">
        <span className="text-base font-semibold tabular-nums text-slate-800">
          {formatCount(count)}
        </span>{" "}
        <span className="text-sm text-slate-400">บิล</span>
      </div>
    </div>
  );
}

export default function TigerPayDailyReport({
  today,
  onViewDetails,
}: {
  today: TigerPayDailyRollup;
  onViewDetails?: () => void;
}) {
  const chartRows = tigerPayReportChartRows(today);

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-slate-800">
          สรุปยอดรับชำระวันนี้
        </h3>
        <div className="flex flex-col gap-2 xl:flex-row xl:items-stretch">
          <FormulaCard
            tone="cash"
            icon={<Coins className="h-5 w-5" />}
            title="เงินสดรับเข้า"
            amount={today.cashIn}
            count={today.cashSuccessCount}
            hint="รับเงินสดจากลูกค้า"
          />
          <Operator>+</Operator>
          <FormulaCard
            tone="qr"
            icon={<QrCode className="h-5 w-5" />}
            title="QR / PromptPay"
            amount={today.qrPromptpayIn}
            count={today.qrSuccessCount}
            hint="รับชำระออนไลน์ (ไม่ผ่านเครื่อง)"
          />
          <Operator>−</Operator>
          <FormulaCard
            tone="out"
            icon={<Wallet className="h-5 w-5" />}
            title="เงินถอนออก"
            amount={today.changeOut}
            count={today.changeBillCount}
            hint="ถอนเงินไปลูกค้า"
          />
          <Operator>−</Operator>
          <FormulaCard
            tone="cn"
            icon={<Wallet className="h-5 w-5" />}
            title="จ่ายคืนลูกค้า (CN)"
            amount={today.voucherUsedAmount}
            count={today.voucherUsedCount}
            hint="คืนเงินสดให้ลูกค้า"
          />
          <Operator>=</Operator>
          <FormulaCard
            tone="net"
            icon={<Coins className="h-5 w-5" />}
            title="ยอดรับชำระสุทธิ"
            amount={today.settledNet}
            hint="ยอดเงินที่รับเข้าทั้งหมด หักถอนและจ่ายคืนลูกค้า"
          />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.9fr)]">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="text-sm font-semibold text-slate-800">
            เงินเข้า – ออกวันนี้
          </h3>
          <div className="relative mt-2 h-64 w-full sm:h-72">
            <span className="absolute left-0 top-0 text-[11px] text-slate-400">
              บาท
            </span>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartRows}
                margin={{ top: 24, right: 8, left: 4, bottom: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e2e8f0"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  interval={0}
                  height={36}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  width={48}
                  tickFormatter={(value: number) =>
                    new Intl.NumberFormat("th-TH").format(value)
                  }
                />
                <Tooltip
                  cursor={{ fill: "rgba(15, 23, 42, 0.04)" }}
                  formatter={(value) => {
                    const n = typeof value === "number" ? value : Number(value);
                    return [formatReportBaht(n), "ยอด"];
                  }}
                />
                <Bar
                  dataKey="value"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={64}
                  label={<ChartBarLabel />}
                >
                  {chartRows.map((row) => (
                    <Cell key={row.key} fill={row.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-800">
              สรุปจำนวนรายการ
            </h3>
            {onViewDetails ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1 px-2 text-xs text-blue-600 hover:text-blue-700"
                onClick={onViewDetails}
              >
                ดูรายละเอียด
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
          <div className="mt-1 divide-y divide-slate-100">
            <CountRow
              icon={<Coins className="h-4 w-4" />}
              iconClass="bg-emerald-50 text-emerald-600"
              label="เงินสด (รับเข้า)"
              count={today.cashSuccessCount}
            />
            <CountRow
              icon={<QrCode className="h-4 w-4" />}
              iconClass="bg-sky-50 text-blue-600"
              label="QR / PromptPay"
              count={today.qrSuccessCount}
            />
            <CountRow
              icon={<Wallet className="h-4 w-4" />}
              iconClass="bg-rose-50 text-rose-500"
              label="คืนสินค้า (CN)"
              count={today.voucherUsedCount}
            />
            <CountRow
              icon={<Ban className="h-4 w-4" />}
              iconClass="bg-slate-100 text-slate-500"
              label="ยกเลิกรายการ"
              count={today.cancelCount}
            />
            <CountRow
              icon={<Clock3 className="h-4 w-4" />}
              iconClass="bg-amber-50 text-amber-600"
              label="รอดำเนินการ"
              count={today.pendingCount}
            />
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section className="flex items-center gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/80 px-5 py-5 shadow-sm sm:gap-5 sm:px-6">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600"
            aria-hidden
          >
            <Wallet className="h-8 w-8" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
              เงินสดรับสุทธิวันนี้
              <TooltipProvider delayDuration={150}>
                <UiTooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-emerald-500 hover:text-emerald-700"
                      aria-label="คำอธิบายเงินสดรับสุทธิวันนี้"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs bg-slate-800 text-xs font-normal">
                    รับเข้า − ถอน − จ่าย CN ไม่รวมเงินทอนที่คงเหลือในเครื่อง
                  </TooltipContent>
                </UiTooltip>
              </TooltipProvider>
            </div>
            <div className="mt-1 text-3xl font-semibold tracking-tight text-emerald-600 sm:text-4xl">
              {formatReportBaht(today.cashNet)}
            </div>
            <p className="mt-1.5 text-xs text-emerald-800/80">
              รับเงินสด {formatReportBaht(today.cashIn, false)} − ถอน{" "}
              {formatReportBaht(today.changeOut, false)} − จ่าย CN{" "}
              {formatReportBaht(today.voucherUsedAmount, false)}
            </p>
            <p className="mt-0.5 text-[11px] text-emerald-700/70">
              (ไม่รวมเงินทอนที่คงเหลือในเครื่อง)
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white px-5 py-5 shadow-sm sm:px-6">
          <div className="flex items-start gap-2">
            <div
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600"
              aria-hidden
            >
              <Info className="h-3.5 w-3.5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">หมายเหตุ</h3>
              <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-500">
                {TIGER_PAY_REPORT_NOTES.map((note) => (
                  <li key={note.term}>
                    <span className="font-medium text-slate-600">
                      {note.term}:
                    </span>{" "}
                    {note.meaning}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
