"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";
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
import { queueTigerPayCashCommand } from "@/lib/bank/tiger-pay-commands";
import type { TigerPayCashSnapshot } from "@/lib/bank/tiger-pay-daily";

const DEFAULT_SHOP = "1";

export default function TigerPayPage() {
  const [refreshToken, setRefreshToken] = useState(0);
  const [tab, setTab] = useState("daily");
  const [hopper, setHopper] = useState<TigerPayCashSnapshot | null>(null);
  const [hopperRefreshing, setHopperRefreshing] = useState(false);

  const refresh = useCallback(() => setRefreshToken((x) => x + 1), []);
  const title = useMemo(() => "Tiger Pay", []);

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

  const runCommand = useCallback(
    async (command: "refresh" | "close", date?: string) => {
      setHopperRefreshing(true);
      try {
        const result = await queueTigerPayCashCommand({
          command,
          shop: DEFAULT_SHOP,
          date,
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
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <BackButton href="/home" />
          <h2 className="flex-1 text-xl font-bold sm:text-2xl">{title}</h2>
          <div className="flex flex-wrap gap-2">
            <TigerPayHopperButton
              hopper={hopper}
              refreshing={hopperRefreshing}
              onRefresh={() => runCommand("refresh")}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              className="shrink-0 gap-1"
            >
              <RefreshCcw strokeWidth={1} className="h-4 w-4" />
              <span>รีเฟรช</span>
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-4">
          <TabsList className="w-fit">
            <TabsTrigger value="daily">สรุปรายวัน</TabsTrigger>
            <TabsTrigger value="list">รายการ</TabsTrigger>
          </TabsList>
          <TabsContent value="daily" className="mt-0">
            <TigerPayDailyStatus
              refreshToken={refreshToken}
              shop={DEFAULT_SHOP}
              onHopperChange={setHopper}
              hopperRefreshing={hopperRefreshing}
              onCloseDay={(date) => runCommand("close", date)}
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
