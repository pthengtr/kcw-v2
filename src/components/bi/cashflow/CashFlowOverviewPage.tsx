"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  Landmark,
  Loader2,
  RefreshCcw,
  Scale,
  Wallet,
} from "lucide-react";

import type { BiCashflowDashboard } from "@/lib/bi/cashflow-dashboard-types";
import {
  formatBahtCompact,
  formatCount,
  pctChange,
} from "@/lib/bi/sales-format";
import { bangkokTodayIso } from "@/lib/bi/sales-periods";
import { cn } from "@/lib/utils";
import BiLoadingBody from "@/components/bi/BiLoadingBody";
import SalesKpiCard from "@/components/bi/sales/SalesKpiCard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import CashFlowBalanceTrendChart from "./CashFlowBalanceTrendChart";
import CashFlowBankReconciliation from "./CashFlowBankReconciliation";
import CashFlowDrilldownDialog from "./CashFlowDrilldownDialog";
import CashFlowMovementChart from "./CashFlowMovementChart";
import CashFlowOperatingBreakdown from "./CashFlowOperatingBreakdown";
import CashFlowStatementTable from "./CashFlowStatementTable";

const MONTH_OPTIONS = [
  { value: "ytd", label: "YTD (ถึงเดือนปัจจุบัน)" },
  { value: "1", label: "ถึง ม.ค." },
  { value: "2", label: "ถึง ก.พ." },
  { value: "3", label: "ถึง มี.ค." },
  { value: "4", label: "ถึง เม.ย." },
  { value: "5", label: "ถึง พ.ค." },
  { value: "6", label: "ถึง มิ.ย." },
  { value: "7", label: "ถึง ก.ค." },
  { value: "8", label: "ถึง ส.ค." },
  { value: "9", label: "ถึง ก.ย." },
  { value: "10", label: "ถึง ต.ค." },
  { value: "11", label: "ถึง พ.ย." },
  { value: "12", label: "ทั้งปี (ธ.ค.)" },
];

function signedClass(value: number): string {
  if (value > 0) return "text-emerald-700";
  if (value < 0) return "text-rose-700";
  return "";
}

export default function CashFlowOverviewPage() {
  const today = bangkokTodayIso();
  const currentYear = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7));

  const [year, setYear] = useState(currentYear);
  const [period, setPeriod] = useState<string>("ytd");
  const [dashboard, setDashboard] = useState<BiCashflowDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drilldown, setDrilldown] = useState<{
    code: string;
    month: number;
    label: string;
  } | null>(null);

  const throughMonth = useMemo(() => {
    if (period === "ytd") {
      return year === currentYear ? currentMonth : 12;
    }
    return Number(period);
  }, [period, year, currentYear, currentMonth]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        year: String(year),
        through_month: String(throughMonth),
      });
      const res = await fetch(`/api/bi/cashflow/dashboard?${params}`);
      const json = (await res.json()) as {
        dashboard?: BiCashflowDashboard;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "โหลดข้อมูลไม่สำเร็จ");
      if (!json.dashboard) throw new Error("ไม่มีข้อมูล");
      setDashboard(json.dashboard);
    } catch (err) {
      setDashboard(null);
      setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [year, throughMonth]);

  useEffect(() => {
    void load();
  }, [load]);

  const yearOptions = useMemo(() => {
    const fromApi = dashboard?.available_years ?? [];
    const set = new Set<number>([...fromApi, currentYear, year]);
    return Array.from(set).sort((a, b) => b - a);
  }, [dashboard?.available_years, currentYear, year]);

  const salesDelta = dashboard
    ? pctChange(
        dashboard.summary.sales_cash_in,
        dashboard.previous_summary.sales_cash_in
      )
    : null;
  const opDelta = dashboard
    ? pctChange(
        dashboard.summary.operating_cash_flow,
        dashboard.previous_summary.operating_cash_flow
      )
    : null;
  const finDelta = dashboard
    ? pctChange(
        dashboard.summary.financing_cash_flow,
        dashboard.previous_summary.financing_cash_flow
      )
    : null;
  const netDelta = dashboard
    ? pctChange(
        dashboard.summary.net_cash_change,
        dashboard.previous_summary.net_cash_change
      )
    : null;

  return (
    <div className="space-y-4 pb-8 md:space-y-5">
      <header className="rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              Cash Flow Dashboard
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              งบกระแสเงินสดจาก bank statement · จัดประเภทก่อนคำนวณ
              (เงินเข้าธนาคาร ≠ ยอดขาย)
            </p>
            {dashboard ? (
              <p className="mt-2 text-xs text-slate-600 sm:text-sm">
                ปี {dashboard.year} · ถึงเดือน {dashboard.through_month} · ณ{" "}
                {dashboard.as_of}
                {" · "}เทียบปีก่อนช่วงเดียวกัน
              </p>
            ) : null}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            className="self-start"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2 h-4 w-4" />
            )}
            รีเฟรช
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="cf-year">ปี</Label>
            <Select
              value={String(year)}
              onValueChange={(v) => setYear(Number(v))}
            >
              <SelectTrigger id="cf-year" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y + 543} ({y})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-period">ช่วง</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger id="cf-period" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {error}
        </div>
      ) : null}

      {loading && !dashboard ? (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-56 shrink-0 rounded-xl" />
          ))}
        </div>
      ) : null}

      {dashboard ? (
        <BiLoadingBody loading={loading}>
          <section className="flex gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-5 lg:overflow-visible">
            <SalesKpiCard
              className={cn("min-w-[12.5rem] shrink-0", signedClass(dashboard.summary.ending_cash))}
              title="Ending Cash"
              value={formatBahtCompact(dashboard.summary.ending_cash)}
              hint={`เปิดงวด ${formatBahtCompact(dashboard.summary.opening_cash)}`}
              icon={<Wallet className="h-4 w-4" />}
            />
            <SalesKpiCard
              className="min-w-[12.5rem] shrink-0"
              title="YTD Sales Cash In"
              value={formatBahtCompact(dashboard.summary.sales_cash_in)}
              deltaPct={salesDelta}
              hint="รหัส 1001"
              icon={<ArrowDownLeft className="h-4 w-4" />}
            />
            <SalesKpiCard
              className={cn(
                "min-w-[12.5rem] shrink-0",
                signedClass(dashboard.summary.operating_cash_flow)
              )}
              title="Operating Cash Flow"
              value={formatBahtCompact(dashboard.summary.operating_cash_flow)}
              deltaPct={opDelta}
              hint="1001−1002−1003−1004"
              icon={<Scale className="h-4 w-4" />}
            />
            <SalesKpiCard
              className={cn(
                "min-w-[12.5rem] shrink-0",
                signedClass(dashboard.summary.financing_cash_flow)
              )}
              title="Financing Cash Flow"
              value={formatBahtCompact(dashboard.summary.financing_cash_flow)}
              deltaPct={finDelta}
              hint="3001−3002"
              icon={<Landmark className="h-4 w-4" />}
            />
            <SalesKpiCard
              className={cn(
                "min-w-[12.5rem] shrink-0",
                signedClass(dashboard.summary.net_cash_change)
              )}
              title="Net Cash Change"
              value={formatBahtCompact(dashboard.summary.net_cash_change)}
              deltaPct={netDelta}
              hint="Operating + Investing + Financing"
              icon={<ArrowLeftRight className="h-4 w-4" />}
            />
          </section>

          {dashboard.summary.unclassified_line_count > 0 ? (
            <section className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
              ยังไม่จัดประเภท {formatCount(dashboard.summary.unclassified_line_count)}{" "}
              รายการ (เข้า {formatBahtCompact(dashboard.summary.unclassified_inflow)} ·
              ออก {formatBahtCompact(dashboard.summary.unclassified_outflow)}) —
              ไม่ได้นับใน Operating/Investing/Financing จนกว่าจะจับคู่รหัส
              (เช่น เงินกู้ต้องเป็น 3001 ไม่ใช่ 1001)
            </section>
          ) : null}

          <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <CashFlowMovementChart rows={dashboard.monthly_movement} />
            <CashFlowBalanceTrendChart rows={dashboard.balance_trend} />
          </section>

          <section>
            <CashFlowStatementTable
              rows={dashboard.statement_rows}
              onCellClick={({ code, month, label }) =>
                setDrilldown({ code, month, label })
              }
            />
          </section>

          <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <CashFlowOperatingBreakdown
              rows={dashboard.operating_breakdown}
              salesCashIn={dashboard.summary.sales_cash_in}
            />
            <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-sm text-slate-700 shadow-sm">
              <p className="font-medium text-slate-900">สูตรหลัก</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs sm:text-sm">
                <li>
                  Operating = ขาย (1001) − ซื้อ (1002) − ค่าใช้จ่าย (1003) −
                  ดอกเบี้ย/ภาษี (1004)
                </li>
                <li>Investing = ขายสินทรัพย์ (2001) − ซื้อสินทรัพย์ (2002)</li>
                <li>Financing = กู้/ลงทุนรับ (3001) − ปันผล/ชำระกู้ (3002)</li>
                <li>Net = Operating + Investing + Financing</li>
                <li>Ending = Opening + Net (งบกระแสเงินสด)</li>
              </ul>
            </div>
          </section>

          <section>
            <CashFlowBankReconciliation
              data={dashboard.bank_reconciliation}
            />
          </section>
        </BiLoadingBody>
      ) : null}

      <CashFlowDrilldownDialog
        open={drilldown != null}
        onOpenChange={(open) => {
          if (!open) setDrilldown(null);
        }}
        year={year}
        month={drilldown?.month ?? 1}
        code={drilldown?.code ?? "1001"}
        label={drilldown?.label ?? ""}
      />
    </div>
  );
}
