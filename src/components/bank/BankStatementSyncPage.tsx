"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCcw } from "lucide-react";

import PermissionGate from "@/components/auth/PermissionGate";
import BackButton from "@/components/common/BackButton";
import { BANK_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ImportFilesTab from "@/components/bank/ImportFilesTab";
import StatementLinesTab from "@/components/bank/StatementLinesTab";
import type { JobQueueRow } from "@/lib/bank/worker-jobs";

type BankSyncMeta = {
  workerOnline: boolean;
  workers: Array<{
    workerName: string;
    online: boolean;
    lastSeen: string | null;
    status: string | null;
  }>;
  inFlightJob: JobQueueRow | null;
};

export default function BankStatementSyncPage() {
  const [tab, setTab] = useState<"import-files" | "statement-lines">(
    "import-files"
  );
  const [refreshToken, setRefreshToken] = useState(0);
  const [meta, setMeta] = useState<BankSyncMeta | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(() => setRefreshToken((x) => x + 1), []);

  const loadMeta = useCallback(async (signal?: AbortSignal) => {
    setMetaError(null);
    try {
      const res = await fetch("/api/bank/meta", { cache: "no-store", signal });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      const data = (await res.json()) as { meta: BankSyncMeta };
      setMeta(data.meta);
    } catch (e) {
      if (String(e).includes("AbortError")) return;
      setMetaError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void loadMeta(ac.signal);
    return () => ac.abort();
  }, [loadMeta, refreshToken]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setSyncing(false);
  }, []);

  const startPolling = useCallback(
    (jobId: number) => {
      stopPolling();
      setSyncing(true);
      setSyncMessage(`กำลัง sync จาก Drive (job #${jobId})…`);

      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/bank/sync/${jobId}`, {
            cache: "no-store",
          });
          if (!res.ok) return;
          const data = (await res.json()) as { job: JobQueueRow };
          const status = data.job.status;
          if (status === "done") {
            stopPolling();
            setSyncMessage(
              data.job.result_message || "Bank sync สำเร็จ — รายการอัปเดตแล้ว"
            );
            refresh();
          } else if (status === "failed") {
            stopPolling();
            setSyncMessage(data.job.error_message || "Bank sync ล้มเหลว");
            refresh();
          }
        } catch {
          // keep polling
        }
      }, 2000);
    },
    [refresh, stopPolling]
  );

  // Resume polling if meta already has an in-flight job
  useEffect(() => {
    if (!meta || syncing) return;
    const job = meta.inFlightJob;
    if (job) {
      startPolling(job.id);
    }
  }, [meta, syncing, startPolling]);

  async function handleSync() {
    setSyncMessage(null);
    setSyncing(true);
    try {
      const res = await fetch("/api/bank/sync", { method: "POST" });
      const body = await res.json().catch(() => ({}));

      if (res.status === 409 && body?.job?.id) {
        setSyncMessage("มี bank sync กำลังรันอยู่แล้ว");
        startPolling(body.job.id as number);
        return;
      }

      if (res.status === 503) {
        setSyncing(false);
        setSyncMessage(body?.error ?? "Worker offline");
        return;
      }

      if (!res.ok) {
        setSyncing(false);
        setSyncMessage(body?.error ?? `Sync failed (${res.status})`);
        return;
      }

      const jobId = body?.job?.id as number;
      startPolling(jobId);
    } catch (e) {
      setSyncing(false);
      setSyncMessage(e instanceof Error ? e.message : String(e));
    }
  }

  const title = useMemo(() => "Bank Statement Sync", []);

  const headerHint = useMemo(() => {
    if (!meta) return null;
    const onlineNames = meta.workers
      .filter((w) => w.online)
      .map((w) => w.workerName);
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant={meta.workerOnline ? "secondary" : "outline"}>
          {meta.workerOnline
            ? `Worker online (${onlineNames.join(", ")})`
            : "Worker offline"}
        </Badge>
        {meta.inFlightJob || syncing ? (
          <Badge variant="outline">กำลัง sync…</Badge>
        ) : null}
      </div>
    );
  }, [meta, syncing]);

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
            {headerHint}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncing || !!meta?.inFlightJob}
            >
              Bank Sync
            </Button>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCcw strokeWidth={1} /> รีเฟรช
            </Button>
          </div>
        </div>

        {metaError ? (
          <p className="mb-3 text-sm text-destructive">{metaError}</p>
        ) : null}
        {syncMessage ? (
          <p className="mb-3 text-sm text-muted-foreground">{syncMessage}</p>
        ) : null}

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
