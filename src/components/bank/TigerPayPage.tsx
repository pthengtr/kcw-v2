"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { QrCode, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

import PermissionGate from "@/components/auth/PermissionGate";
import BackButton from "@/components/common/BackButton";
import { BANK_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TigerPayTab from "@/components/bank/TigerPayTab";
import TigerPayDailyStatus from "@/components/bank/TigerPayDailyStatus";
import TigerPayHopperButton from "@/components/bank/TigerPayHopperButton";
import TigerPayReportHeader from "@/components/bank/TigerPayReportHeader";
import { queueTigerPayCashCommand } from "@/lib/bank/tiger-pay-commands";
import { formatBaht } from "@/lib/bank/tiger-pay-format";
import {
  formatThaiMonth,
  type TigerPayCashSnapshot,
  type TigerPayDailyClose,
  type TigerPayKbankQrMonth,
} from "@/lib/bank/tiger-pay-daily";
import { formatCount } from "@/lib/bi/sales-format";
import { bangkokTodayIso } from "@/lib/bi/sales-periods";

const DEFAULT_SHOP = "1";

export default function TigerPayPage() {
  const [refreshToken, setRefreshToken] = useState(0);
  const [tab, setTab] = useState("daily");
  const [date, setDate] = useState(() => bangkokTodayIso());
  const [hopper, setHopper] = useState<TigerPayCashSnapshot | null>(null);
  const [dailyClose, setDailyClose] = useState<TigerPayDailyClose | null>(null);
  const [hopperRefreshing, setHopperRefreshing] = useState(false);
  const [zReportTick, setZReportTick] = useState(0);
  const [kbankQrMonth, setKbankQrMonth] = useState<TigerPayKbankQrMonth | null>(
    null
  );

  const refresh = useCallback(() => setRefreshToken((x) => x + 1), []);
  const title = useMemo(() => "รายงาน Tiger Pay", []);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const params = new URLSearchParams({ shop: DEFAULT_SHOP });
        const res = await fetch(`/api/bank/tiger-pay/hopper?${params}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) return;
        const json = (await res.json()) as { hopper: TigerPayCashSnapshot | null };
        setHopper(json.hopper ?? null);
      } catch {
        // Daily tab will surface hopper errors if needed.
      }
    })();
    return () => controller.abort();
  }, [refreshToken]);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const params = new URLSearchParams({ shop: DEFAULT_SHOP, date });
        const res = await fetch(`/api/bank/tiger-pay/kbank-qr-month?${params}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) return;
        const json = (await res.json()) as {
          kbankQrMonth: TigerPayKbankQrMonth;
        };
        setKbankQrMonth(json.kbankQrMonth ?? null);
      } catch {
        // Header total is optional if the daily tab is still usable.
      }
    })();
    return () => controller.abort();
  }, [date, refreshToken]);

  const runCommand = useCallback(
    async (command: "refresh" | "close", closeDate?: string) => {
      setHopperRefreshing(true);
      try {
        const result = await queueTigerPayCashCommand({
          command,
          shop: DEFAULT_SHOP,
          date: closeDate,
        });
        if (result.status === "done") {
          toast.success(
            command === "close" ? "ปิดวันแล้ว" : "อัปเดตสถานะเงินทอนแล้ว"
          );
        } else {
          toast.error(result.error || "เครื่องไม่ตอบ");
        }
        refresh();
      } catch {
        toast.error("ส่งคำสั่งไปเครื่องไม่สำเร็จ");
      } finally {
        setHopperRefreshing(false);
      }
    },
    [refresh]
  );

  return (
    <PermissionGate
      pageKey={BANK_PAGE_KEYS.tigerPay}
      fallback={
        <div className="px-4 py-4 sm:px-8 sm:py-6">
          <Card>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>คุณไม่มีสิทธิ์เข้าถึงหน้านี้</CardContent>
          </Card>
        </div>
      }
    >
      <div className="px-4 py-4 sm:px-8 sm:py-6">
        <div className="mb-3">
          <BackButton href="/home" />
        </div>
        <TigerPayReportHeader
          date={date}
          onDateChange={setDate}
          dailyClose={dailyClose}
          hopperRefreshing={hopperRefreshing}
          onCloseDay={(closeDate) => runCommand("close", closeDate)}
          onViewZReport={() => {
            setTab("daily");
            setZReportTick((tick) => tick + 1);
          }}
          showDateControls={tab === "daily"}
          extraActions={
            <>
              <TigerPayHopperButton
                hopper={hopper}
                refreshing={hopperRefreshing}
                onRefresh={() => runCommand("refresh")}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={refresh}
                className="h-9 shrink-0 gap-1 bg-white"
              >
                <RefreshCcw strokeWidth={1} className="h-4 w-4" />
                <span>รีเฟรช</span>
              </Button>
            </>
          }
        />

        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-sky-100 bg-sky-50/90 px-4 py-3.5 shadow-sm">
          <div
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-blue-600"
            aria-hidden
          >
            <QrCode className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-slate-500">
              KBANK QR เดือนนี้
              {kbankQrMonth ? ` · ${formatThaiMonth(kbankQrMonth.yearMonth)}` : ""}
            </div>
            <div className="mt-0.5 text-xl font-semibold tracking-tight text-blue-600 sm:text-2xl">
              {kbankQrMonth ? formatBaht(kbankQrMonth.total) : "—"}
            </div>
            <p className="mt-1 text-[11px] leading-snug text-slate-400">
              {kbankQrMonth
                ? `${formatCount(kbankQrMonth.count)} บิลสำเร็จ · `
                : ""}
              เฉพาะ QR ของ KBANK ที่ชำระสำเร็จในเดือนนี้ ใช้เช็คกับเพดาน API ของธนาคาร
            </p>
          </div>
        </div>

        <Tabs
          value={tab}
          onValueChange={setTab}
          className="mt-5 flex flex-col gap-4"
        >
          <TabsList className="w-fit">
            <TabsTrigger value="daily">สรุปรายวัน</TabsTrigger>
            <TabsTrigger value="list">รายการ</TabsTrigger>
          </TabsList>
          <TabsContent value="daily" className="mt-0">
            <TigerPayDailyStatus
              refreshToken={refreshToken}
              shop={DEFAULT_SHOP}
              date={date}
              onHopperChange={setHopper}
              onDailyCloseChange={setDailyClose}
              onViewDetails={() => setTab("list")}
              zReportTick={zReportTick}
            />
          </TabsContent>
          <TabsContent value="list" className="mt-0">
            <TigerPayTab refreshToken={refreshToken} />
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGate>
  );
}
