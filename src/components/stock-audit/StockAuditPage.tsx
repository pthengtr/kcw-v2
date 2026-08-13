"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  PackageSearch,
  RefreshCcw,
  Target,
} from "lucide-react";
import { toast } from "sonner";

import { formatCount } from "@/lib/bi/sales-format";
import {
  STOCK_AUDIT_BUCKETS,
  bucketMeta,
  type StockAuditBranch,
  type StockAuditBucket,
  type StockAuditLookup,
  type StockAuditOverview,
} from "@/lib/stock-audit/types";
import { STOCK_AUDIT_DAILY_TARGET } from "@/lib/stock-audit/daily-target";
import { cn } from "@/lib/utils";
import SalesKpiCard from "@/components/bi/sales/SalesKpiCard";
import StockAuditDailyChart from "@/components/stock-audit/StockAuditDailyChart";
import StockAuditFreshnessPie from "@/components/stock-audit/StockAuditFreshnessPie";
import StockAuditOperatorTable from "@/components/stock-audit/StockAuditOperatorTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type TabId = "status" | "lookup";

const PAGE_SIZE = 50;

function summaryCount(
  overview: StockAuditOverview | null,
  key: StockAuditBucket
): number {
  if (!overview) return 0;
  const s = overview.summary;
  switch (key) {
    case "never":
      return s.never_count;
    case "d30":
      return s.d30_count;
    case "d90":
      return s.d90_count;
    case "d180":
      return s.d180_count;
    case "d365":
      return s.d365_count;
    case "over_365":
      return s.over_365_count;
  }
}

export default function StockAuditPage() {
  const [tab, setTab] = useState<TabId>("status");
  const [branch, setBranch] = useState<StockAuditBranch>("HQ");
  const [withStockOnly, setWithStockOnly] = useState(true);
  const [bucket, setBucket] = useState<StockAuditBucket | "ALL">("never");
  const [offset, setOffset] = useState(0);
  const [overview, setOverview] = useState<StockAuditOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [lookupBcode, setLookupBcode] = useState("");
  const [lookup, setLookup] = useState<StockAuditLookup | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  const loadOverview = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          branch,
          with_stock_only: String(withStockOnly),
          limit: String(PAGE_SIZE),
          offset: String(offset),
        });
        if (bucket !== "ALL") params.set("bucket", bucket);
        const res = await fetch(`/api/stock-audit/overview?${params}`, {
          signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "load failed");
        setOverview(data.overview as StockAuditOverview);
      } catch (e) {
        if (signal?.aborted) return;
        setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
        setOverview(null);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [branch, withStockOnly, bucket, offset]
  );

  useEffect(() => {
    const ac = new AbortController();
    void loadOverview(ac.signal);
    return () => ac.abort();
  }, [loadOverview]);

  async function runLookup() {
    const bcode = lookupBcode.trim();
    if (!bcode) return;
    setLookupLoading(true);
    setLookup(null);
    try {
      const params = new URLSearchParams({ branch, bcode });
      const res = await fetch(`/api/stock-audit/lookup?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "lookup failed");
      setLookup(data.product as StockAuditLookup);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ค้นหาไม่สำเร็จ");
    } finally {
      setLookupLoading(false);
    }
  }

  const todayDone = overview?.summary.marked_today_count ?? 0;
  const weekDone = overview?.summary.marked_week_count ?? 0;
  const todayProgress = Math.min(
    100,
    Math.round((100 * todayDone) / STOCK_AUDIT_DAILY_TARGET)
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6">
      <header className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-3">
          <ClipboardCheck className="h-7 w-7 text-blue-600" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            สถานะตรวจนับ
          </h1>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          ดูความคืบหน้าและ KPI จากสาขา · การนับจริงทำผ่าน LINE (พิมพ์ เช็คสต็อก)
          บน Wi‑Fi สาขา
        </p>
      </header>

      <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-950">
        นับสต็อกที่สาขาผ่าน LINE แล้วระบบจะซิงก์ขึ้นหน้านี้ให้อัตโนมัติ —
        ไม่สร้างชุดงานหรือกด “ตรวจแล้ว” จากหลังบ้านอีกต่อไป
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label>สาขา</Label>
          <Select
            value={branch}
            onValueChange={(v) => {
              setBranch(v as StockAuditBranch);
              setOffset(0);
            }}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="HQ">HQ</SelectItem>
              <SelectItem value="SYP">SYP</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>ขอบเขต</Label>
          <Select
            value={withStockOnly ? "stock" : "all"}
            onValueChange={(v) => {
              setWithStockOnly(v === "stock");
              setOffset(0);
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stock">มีของคงเหลือ</SelectItem>
              <SelectItem value="all">ทุกรหัส</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-1.5"
          onClick={() => void loadOverview()}
          disabled={loading}
        >
          <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
          รีเฟรช
        </Button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-medium text-slate-800">
            ความคืบหน้าวันนี้ · เป้า {STOCK_AUDIT_DAILY_TARGET}
          </span>
          <span className="tabular-nums text-muted-foreground">
            {formatCount(todayDone)} / {formatCount(STOCK_AUDIT_DAILY_TARGET)}
            <span className="mx-2 text-slate-300">·</span>
            7 วัน {formatCount(weekDone)}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{ width: `${todayProgress}%` }}
          />
        </div>
      </div>

      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        {(
          [
            { id: "status" as const, label: "สถานะ", icon: Target },
            { id: "lookup" as const, label: "ค้นหารหัส", icon: PackageSearch },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition",
              tab === id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {tab === "status" ? (
        <section className="space-y-5">
          {loading && !overview ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-56 rounded-lg" />
              <Skeleton className="h-56 rounded-lg" />
            </div>
          ) : overview ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SalesKpiCard
                  title="วันนี้"
                  value={`${formatCount(todayDone)} / ${formatCount(STOCK_AUDIT_DAILY_TARGET)}`}
                  hint="เป้าแนะนำต่อวัน (สาขา)"
                  icon={<CheckCircle2 className="h-4 w-4" />}
                />
                <SalesKpiCard
                  title="7 วันนี้"
                  value={formatCount(weekDone)}
                  hint="จำนวนที่ตรวจแล้ว"
                  icon={<Target className="h-4 w-4" />}
                />
                <SalesKpiCard
                  title="ยังไม่เคยตรวจ"
                  value={formatCount(overview.summary.never_count)}
                  hint={`จาก ${formatCount(overview.summary.total)} รหัสที่มีสต็อก`}
                />
                <SalesKpiCard
                  title="สด ≤ 30 วัน"
                  value={formatCount(overview.summary.d30_count)}
                  hint="สุขภาพสต็อกที่ดี"
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <StockAuditFreshnessPie overview={overview} />
                <StockAuditDailyChart
                  series={overview.daily_marks}
                  markedToday={todayDone}
                  markedWeek={weekDone}
                />
              </div>

              <StockAuditOperatorTable
                rows={overview.operator_marks ?? []}
              />

              <div>
                <h2 className="mb-2 text-sm font-semibold text-slate-800">
                  รายการตามสถานะ
                </h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBucket("ALL");
                      setOffset(0);
                    }}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium transition",
                      bucket === "ALL"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    )}
                  >
                    ทั้งหมด {formatCount(overview.summary.total)}
                  </button>
                  {STOCK_AUDIT_BUCKETS.map((b) => {
                    const count = summaryCount(overview, b.key);
                    return (
                      <button
                        key={b.key}
                        type="button"
                        onClick={() => {
                          setBucket(b.key);
                          setOffset(0);
                        }}
                        className={cn(
                          "rounded-md px-3 py-1.5 text-sm font-medium transition",
                          b.chip,
                          bucket === b.key &&
                            "ring-2 ring-slate-900 ring-offset-1"
                        )}
                      >
                        {b.label} {formatCount(count)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">รหัส</th>
                      <th className="px-3 py-2 font-medium">รายละเอียด</th>
                      <th className="hidden px-3 py-2 font-medium sm:table-cell">
                        ที่เก็บ
                      </th>
                      <th className="px-3 py-2 text-right font-medium">คงเหลือ</th>
                      <th className="px-3 py-2 font-medium">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {overview.rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-3 py-8 text-center text-muted-foreground"
                        >
                          ไม่มีรายการในตัวกรองนี้
                        </td>
                      </tr>
                    ) : (
                      overview.rows.map((row) => {
                        const meta = bucketMeta(row.bucket);
                        return (
                          <tr key={row.bcode}>
                            <td className="px-3 py-2 font-mono text-xs font-semibold">
                              {row.bcode}
                            </td>
                            <td className="max-w-[220px] truncate px-3 py-2 text-slate-700">
                              {row.descr || "—"}
                            </td>
                            <td className="hidden px-3 py-2 text-muted-foreground sm:table-cell">
                              {row.location1 || "—"}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatCount(row.qty)}
                            </td>
                            <td className="px-3 py-2">
                              <Badge
                                variant="outline"
                                className={cn("font-normal", meta.chip)}
                              >
                                {meta.label}
                                {row.app_dateaudit
                                  ? ` · ${row.app_dateaudit}`
                                  : ""}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">
                  แสดง {formatCount(overview.rows.length)} จาก{" "}
                  {formatCount(overview.row_total)}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={offset <= 0 || loading}
                    onClick={() =>
                      setOffset((o) => Math.max(0, o - PAGE_SIZE))
                    }
                  >
                    ก่อนหน้า
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      loading || offset + PAGE_SIZE >= overview.row_total
                    }
                    onClick={() => setOffset((o) => o + PAGE_SIZE)}
                  >
                    ถัดไป
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {tab === "lookup" ? (
        <section className="space-y-4">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void runLookup();
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="lookup-bcode">BCODE</Label>
              <Input
                id="lookup-bcode"
                className="w-[200px] font-mono"
                value={lookupBcode}
                onChange={(e) => setLookupBcode(e.target.value)}
                placeholder="เช่น 13050478"
              />
            </div>
            <Button
              type="submit"
              disabled={lookupLoading || !lookupBcode.trim()}
              className="gap-1.5"
            >
              {lookupLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PackageSearch className="h-4 w-4" />
              )}
              ค้นหา
            </Button>
          </form>

          {lookup ? (
            lookup.found ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="font-mono text-lg font-semibold">{lookup.bcode}</p>
                <p className="mt-1 text-slate-700">{lookup.descr || "—"}</p>
                <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">ที่เก็บ</dt>
                    <dd className="text-sm font-medium">
                      {lookup.location1 || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">คงเหลือ</dt>
                    <dd className="text-sm font-medium tabular-nums">
                      {formatCount(lookup.qty ?? 0)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">ตรวจล่าสุด</dt>
                    <dd className="text-sm font-medium">
                      {lookup.app_dateaudit || "ยังไม่เคย"}
                      {lookup.app_audited_by
                        ? ` · ${lookup.app_audited_by.split("|")[0]}`
                        : ""}
                    </dd>
                  </div>
                </dl>
                {lookup.pos_dateaudit ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    วันที่ใน POS (อ้างอิง): {lookup.pos_dateaudit}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                ไม่พบรหัสนี้ในสาขา {branch}
              </p>
            )
          ) : (
            <p className="text-sm text-muted-foreground">
              ค้นหาเพื่อดูสถานะการตรวจล่าสุด (อ่านอย่างเดียว)
            </p>
          )}
        </section>
      ) : null}
    </main>
  );
}
