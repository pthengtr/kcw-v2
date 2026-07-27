"use client";

import { useCallback, useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";

import PermissionGate from "@/components/auth/PermissionGate";
import BackButton from "@/components/common/BackButton";
import { BANK_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import TigerPayTab from "@/components/bank/TigerPayTab";

export default function TigerPayPage() {
  const [refreshToken, setRefreshToken] = useState(0);

  const refresh = useCallback(() => setRefreshToken((x) => x + 1), []);
  const title = useMemo(() => "Tiger Pay", []);

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

        <TigerPayTab refreshToken={refreshToken} />
      </div>
    </PermissionGate>
  );
}
