"use client";

import { useCallback, useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";

import PermissionGate from "@/components/auth/PermissionGate";
import { BANK_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ImportFilesTab from "@/components/bank/ImportFilesTab";
import StatementLinesTab from "@/components/bank/StatementLinesTab";

export default function BankStatementSyncPage() {
  const [tab, setTab] = useState<"import-files" | "statement-lines">(
    "import-files"
  );
  const [refreshToken, setRefreshToken] = useState(0);

  const refresh = useCallback(() => setRefreshToken((x) => x + 1), []);

  const title = useMemo(() => "Bank Statement Sync", []);

  return (
    <PermissionGate
      pageKey={BANK_PAGE_KEYS.statementSync}
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
          <h2 className="flex-1 text-xl font-bold sm:text-2xl">{title}</h2>
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCcw strokeWidth={1} /> รีเฟรช
          </Button>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="h-auto w-full flex-wrap justify-start sm:w-auto">
            <TabsTrigger value="import-files">Import Files</TabsTrigger>
            <TabsTrigger value="statement-lines">Statement Lines</TabsTrigger>
          </TabsList>

          <TabsContent value="import-files" className="mt-4">
            <ImportFilesTab refreshToken={refreshToken} />
          </TabsContent>
          <TabsContent value="statement-lines" className="mt-4">
            <StatementLinesTab refreshToken={refreshToken} />
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGate>
  );
}
