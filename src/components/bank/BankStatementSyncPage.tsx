"use client";

import { useCallback, useMemo, useState } from "react";
import { Loader2, RefreshCcw, Upload } from "lucide-react";

import PermissionGate from "@/components/auth/PermissionGate";
import BackButton from "@/components/common/BackButton";
import { BANK_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ImportFilesTab from "@/components/bank/ImportFilesTab";
import StatementLinesTab from "@/components/bank/StatementLinesTab";
import StatementUploadDialog from "@/components/bank/StatementUploadDialog";
import { formatBankStatementImportMessage } from "@/lib/bank/statement-upload";

export default function BankStatementSyncPage() {
  const [tab, setTab] = useState<"import-files" | "statement-lines">(
    "statement-lines"
  );
  const [refreshToken, setRefreshToken] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshToken((x) => x + 1);
    // Let child tabs react to refreshToken; brief spinner for feedback.
    await new Promise((r) => setTimeout(r, 200));
    setRefreshing(false);
  }, []);

  const title = useMemo(() => "Bank Statement", []);

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
          <BackButton href="/home" />
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold sm:text-2xl">{title}</h2>
            <p className="text-sm text-muted-foreground">
              อัปโหลด Excel statement (KBANK / KTB) แล้วจับคู่รายการ
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUploadOpen(true)}
            >
              <Upload className="mr-1 h-4 w-4" />
              อัปโหลด Statement
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refresh()}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw strokeWidth={1} className="h-4 w-4" />
              )}{" "}
              รีเฟรช
            </Button>
          </div>
        </div>

        {uploadMessage ? (
          <p className="mb-3 text-sm text-muted-foreground">{uploadMessage}</p>
        ) : null}

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="h-auto w-full flex-wrap justify-start sm:w-auto">
            <TabsTrigger value="statement-lines">Statement Lines</TabsTrigger>
            <TabsTrigger value="import-files">Import Files</TabsTrigger>
          </TabsList>

          <TabsContent value="statement-lines" className="mt-4">
            <StatementLinesTab refreshToken={refreshToken} />
          </TabsContent>
          <TabsContent value="import-files" className="mt-4">
            <ImportFilesTab refreshToken={refreshToken} />
          </TabsContent>
        </Tabs>
      </div>

      <StatementUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onImported={(result) => {
          setUploadMessage(formatBankStatementImportMessage(result));
          setRefreshToken((x) => x + 1);
          if (result.status === "imported") {
            setTab("import-files");
          }
        }}
      />
    </PermissionGate>
  );
}
