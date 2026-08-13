"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Images, Loader2, RefreshCcw } from "lucide-react";

import { formatCount } from "@/lib/bi/sales-format";
import {
  productImageEventLabel,
  type ProductImageKpi,
} from "@/lib/product-image-kpi/types";
import { cn } from "@/lib/utils";
import SalesKpiCard from "@/components/bi/sales/SalesKpiCard";
import BackButton from "@/components/common/BackButton";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function bangkokTodayIsoDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

function formatActivityTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default function ProductImageKpiPageClient() {
  const [kpi, setKpi] = useState<ProductImageKpi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const today = bangkokTodayIsoDate();
      const from = addDaysIso(today, -6);
      const params = new URLSearchParams({ from, to: today });
      const res = await fetch(`/api/product-images/kpi?${params}`, { signal });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "load failed");
      setKpi(data.kpi as ProductImageKpi);
    } catch (e) {
      if (signal?.aborted) return;
      setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
      setKpi(null);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  const today = kpi?.summary_today;
  const range = kpi?.summary_range;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <BackButton href="/home" />
          <header className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <Images className="h-7 w-7 text-rose-600" aria-hidden />
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                KPI รูปสินค้า
              </h1>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              ดูงานอัปโหลด / แทนที่ / ลบรูปจาก LINE · จัดการช่องรูปแยกที่หน้าแอดมิน
            </p>
          </header>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/product-images">จัดการรูป</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
            รีเฟรช
          </Button>
        </div>
      </div>

      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        <span className="flex flex-1 items-center justify-center rounded-md bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm">
          KPI
        </span>
        <Link
          href="/product-images"
          className="flex flex-1 items-center justify-center rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
        >
          จัดการรูป
        </Link>
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {loading && !kpi ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
        </div>
      ) : kpi && today && range ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SalesKpiCard
              title="วันนี้ทั้งหมด"
              value={formatCount(today.total_actions)}
              hint={`สินค้าที่ไม่ซ้ำ ${formatCount(today.unique_products)}`}
            />
            <SalesKpiCard
              title="อัปโหลดวันนี้"
              value={formatCount(today.uploads)}
              hint="ช่องใหม่"
            />
            <SalesKpiCard
              title="แทนที่วันนี้"
              value={formatCount(today.replaces)}
              hint="เขียนทับช่องเดิม"
            />
            <SalesKpiCard
              title="ลบวันนี้"
              value={formatCount(today.deletes)}
              hint="ลบช่องรูป"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            ช่วง {kpi.from} – {kpi.to} · รวม {formatCount(range.total_actions)}{" "}
            รายการ · สินค้า {formatCount(range.unique_products)} รหัส
          </p>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-slate-900">
                ผู้ปฏิบัติงาน
              </h2>
              <p className="text-xs text-muted-foreground">
                จัดอันดับตามงานวันนี้ แล้วตามช่วง 7 วัน
              </p>
            </div>
            {kpi.operators.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                ยังไม่มีเหตุการณ์รูปสินค้าในระบบ — เมื่ออัปโหลดผ่าน LINE จะโชว์ที่นี่
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs text-muted-foreground">
                      <th className="pb-2 pr-3 font-medium">ชื่อ</th>
                      <th className="pb-2 pr-2 text-right font-medium">วันนี้</th>
                      <th className="pb-2 pr-2 text-right font-medium">อัปโหลด</th>
                      <th className="pb-2 pr-2 text-right font-medium">แทนที่</th>
                      <th className="pb-2 pr-2 text-right font-medium">ลบ</th>
                      <th className="pb-2 text-right font-medium">7 วัน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpi.operators.map((row) => (
                      <tr
                        key={row.line_user_id}
                        className="border-b border-slate-50 last:border-0"
                      >
                        <td className="py-2.5 pr-3 font-medium text-slate-800">
                          {row.display_name}
                        </td>
                        <td className="py-2.5 pr-2 text-right tabular-nums font-semibold">
                          {formatCount(row.total_today)}
                        </td>
                        <td className="py-2.5 pr-2 text-right tabular-nums text-slate-700">
                          {formatCount(row.uploads_today)}
                        </td>
                        <td className="py-2.5 pr-2 text-right tabular-nums text-slate-700">
                          {formatCount(row.replaces_today)}
                        </td>
                        <td className="py-2.5 pr-2 text-right tabular-nums text-slate-700">
                          {formatCount(row.deletes_today)}
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-slate-700">
                          {formatCount(row.total_actions)}
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({formatCount(row.unique_products)} รหัส)
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-slate-900">
                กิจกรรมล่าสุด
              </h2>
              <p className="text-xs text-muted-foreground">
                สูงสุด 100 รายการในช่วงที่เลือก
              </p>
            </div>
            {kpi.activity.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                ยังไม่มีกิจกรรม
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {kpi.activity.map((row, idx) => (
                  <li
                    key={`${row.created_at}-${row.bcode}-${idx}`}
                    className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <span className="font-medium text-slate-800">
                        {row.display_name || "—"}
                      </span>
                      <span className="mx-1.5 text-slate-300">·</span>
                      <span className="text-slate-600">
                        {productImageEventLabel(row.event_type)}
                      </span>
                      <span className="mx-1.5 text-slate-300">·</span>
                      <span className="font-mono text-xs font-semibold text-slate-800">
                        {row.bcode}
                      </span>
                    </div>
                    <time className="shrink-0 text-xs text-muted-foreground">
                      {formatActivityTime(row.created_at)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          กำลังโหลด…
        </div>
      ) : null}
    </main>
  );
}
