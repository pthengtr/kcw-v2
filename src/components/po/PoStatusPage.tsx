"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCcw } from "lucide-react";

import PermissionGate from "@/components/auth/PermissionGate";
import BackButton from "@/components/common/BackButton";
import { PO_PAGE_KEYS } from "@/lib/auth/rbac-pages";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PoHqTab from "@/components/po/PoHqTab";
import PoSypTab from "@/components/po/PoSypTab";
import { formatPoTs } from "@/lib/po/format";
import type { JobQueueRow } from "@/lib/po/worker-jobs";
import type { PoSyncSite } from "@/lib/po/worker-jobs";

type SiteMeta = {
  lastIngestedAt: string | null;
  workerName: string;
  workerOnline: boolean;
  workerLastSeen: string | null;
  workerStatus: string | null;
  inFlightJob: JobQueueRow | null;
};

type PoMeta = Record<PoSyncSite, SiteMeta>;

type InventoryMeta = {
  hqLastUpdatedAt: string | null;
  inFlightJobs: JobQueueRow[];
};

type IclowMeta = {
  hqLastIngestedAt: string | null;
  sypLastIngestedAt: string | null;
  inFlightJobs: JobQueueRow[];
};

type SimasMeta = {
  hqLastIngestedAt: string | null;
};

type PoRelatedMeta = {
  inFlightJobs: JobQueueRow[];
};

export default function PoStatusPage() {
  const [tab, setTab] = useState<"hq" | "syp">("syp");
  const [refreshToken, setRefreshToken] = useState(0);
  const [meta, setMeta] = useState<PoMeta | null>(null);
  const [inventoryMeta, setInventoryMeta] = useState<InventoryMeta | null>(
    null
  );
  const [iclowMeta, setIclowMeta] = useState<IclowMeta | null>(null);
  const [simasMeta, setSimasMeta] = useState<SimasMeta | null>(null);
  const [poRelatedMeta, setPoRelatedMeta] = useState<PoRelatedMeta | null>(
    null
  );
  const [metaError, setMetaError] = useState<string | null>(null);
  const [relatedSyncing, setRelatedSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const relatedPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(() => setRefreshToken((x) => x + 1), []);

  const loadMeta = useCallback(async (signal?: AbortSignal) => {
    setMetaError(null);
    try {
      const res = await fetch("/api/po/meta", { cache: "no-store", signal });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      const data = (await res.json()) as {
        meta: PoMeta;
        inventory: InventoryMeta;
        iclow?: IclowMeta;
        simas?: SimasMeta;
        poRelated?: PoRelatedMeta;
      };
      setMeta(data.meta);
      setInventoryMeta(data.inventory);
      setIclowMeta(data.iclow ?? null);
      setSimasMeta(data.simas ?? null);
      setPoRelatedMeta(data.poRelated ?? null);
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
      if (relatedPollRef.current) clearInterval(relatedPollRef.current);
    };
  }, []);

  const stopRelatedPolling = useCallback(() => {
    if (relatedPollRef.current) {
      clearInterval(relatedPollRef.current);
      relatedPollRef.current = null;
    }
    setRelatedSyncing(false);
  }, []);

  const startRelatedPolling = useCallback(
    (jobs: JobQueueRow[]) => {
      stopRelatedPolling();
      const jobIds = jobs.map((j) => j.id);
      if (jobIds.length === 0) return;

      setRelatedSyncing(true);
      setSyncMessage(
        `กำลังอัปเดต HQ+SYP (job ${jobIds.map((id) => `#${id}`).join(", ")})…`
      );

      const pending = new Map(jobIds.map((id) => [id, "pending" as string]));

      relatedPollRef.current = setInterval(async () => {
        try {
          await Promise.all(
            jobIds.map(async (jobId) => {
              if (
                pending.get(jobId) === "done" ||
                pending.get(jobId)?.startsWith("failed")
              ) {
                return;
              }
              const res = await fetch(`/api/po/related-sync/${jobId}`, {
                cache: "no-store",
              });
              if (!res.ok) return;
              const data = (await res.json()) as { job: JobQueueRow };
              if (data.job.status === "failed") {
                pending.set(
                  jobId,
                  `failed:${data.job.error_message || "failed"}`
                );
              } else {
                pending.set(jobId, data.job.status);
              }
            })
          );

          const values = [...pending.values()];
          const allTerminal = values.every(
            (s) => s === "done" || s.startsWith("failed")
          );
          if (!allTerminal) return;

          stopRelatedPolling();
          const failed = values.filter((s) => s.startsWith("failed"));
          if (failed.length === 0) {
            setSyncMessage("อัปเดตข้อมูล PO สำเร็จ");
          } else {
            const msgs = failed
              .map((s) => s.replace(/^failed:?/, "") || "ล้มเหลว")
              .join("; ");
            setSyncMessage(`อัปเดตข้อมูล PO ล้มเหลว: ${msgs}`);
          }
          refresh();
        } catch {
          // keep polling
        }
      }, 2000);
    },
    [refresh, stopRelatedPolling]
  );

  useEffect(() => {
    if (!poRelatedMeta || relatedSyncing) return;
    if (poRelatedMeta.inFlightJobs.length > 0) {
      startRelatedPolling(poRelatedMeta.inFlightJobs);
    }
  }, [poRelatedMeta, relatedSyncing, startRelatedPolling]);

  async function handleRelatedSync() {
    setSyncMessage(null);
    setRelatedSyncing(true);
    try {
      const res = await fetch("/api/po/related-sync", { method: "POST" });
      const body = await res.json().catch(() => ({}));

      if (res.status === 409 && Array.isArray(body?.jobs) && body.jobs.length) {
        setSyncMessage("มีอัปเดตข้อมูล PO กำลังรันอยู่แล้ว");
        startRelatedPolling(body.jobs as JobQueueRow[]);
        return;
      }

      if (res.status === 503) {
        setRelatedSyncing(false);
        setSyncMessage(body?.error ?? "Worker offline");
        return;
      }

      if (!res.ok) {
        setRelatedSyncing(false);
        setSyncMessage(body?.error ?? `Sync failed (${res.status})`);
        return;
      }

      const jobs = (body?.jobs ?? []) as JobQueueRow[];
      startRelatedPolling(jobs);
    } catch (e) {
      setRelatedSyncing(false);
      setSyncMessage(e instanceof Error ? e.message : String(e));
    }
  }

  const relatedInFlight =
    relatedSyncing || (poRelatedMeta?.inFlightJobs.length ?? 0) > 0;

  const headerHint = useMemo(() => {
    if (!meta) return null;
    return (
      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>PO HQ: {formatPoTs(meta.HQ?.lastIngestedAt ?? null)}</span>
          <span>PO SYP: {formatPoTs(meta.SYP?.lastIngestedAt ?? null)}</span>
          <span>
            ICLOW HQ: {formatPoTs(iclowMeta?.hqLastIngestedAt ?? null)}
          </span>
          <span>
            ICLOW SYP: {formatPoTs(iclowMeta?.sypLastIngestedAt ?? null)}
          </span>
          <span>
            สต็อก HQ: {formatPoTs(inventoryMeta?.hqLastUpdatedAt ?? null)}
          </span>
          <span>
            SIMas HQ: {formatPoTs(simasMeta?.hqLastIngestedAt ?? null)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={meta.HQ?.workerOnline ? "secondary" : "outline"}>
            HQ-PC {meta.HQ?.workerOnline ? "online" : "offline"}
          </Badge>
          <Badge variant={meta.SYP?.workerOnline ? "secondary" : "outline"}>
            SYP-PC {meta.SYP?.workerOnline ? "online" : "offline"}
          </Badge>
          {relatedInFlight ? (
            <Badge variant="outline">กำลังอัปเดต…</Badge>
          ) : null}
        </div>
      </div>
    );
  }, [
    meta,
    iclowMeta,
    inventoryMeta?.hqLastUpdatedAt,
    simasMeta?.hqLastIngestedAt,
    relatedInFlight,
  ]);

  return (
    <PermissionGate
      pageKey={PO_PAGE_KEYS.status}
      fallback={
        <div className="px-4 py-4 sm:px-8 sm:py-6">
          <Card>
            <CardHeader>
              <CardTitle>สถานะใบสั่งซื้อ (PO)</CardTitle>
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
            <h2 className="text-xl font-bold sm:text-2xl">
              สถานะใบสั่งซื้อ (PO)
            </h2>
            {headerHint}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleRelatedSync()}
              disabled={relatedInFlight}
            >
              อัปเดตข้อมูล
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

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as typeof tab)}
        >
          <TabsList className="h-auto w-fit max-w-full flex-wrap justify-start">
            <TabsTrigger value="syp">SYP (โอนจาก HQ)</TabsTrigger>
            <TabsTrigger value="hq">HQ (ซัพพลายเออร์)</TabsTrigger>
          </TabsList>

          <TabsContent value="syp" className="mt-4">
            <PoSypTab refreshToken={refreshToken} />
          </TabsContent>
          <TabsContent value="hq" className="mt-4">
            <PoHqTab refreshToken={refreshToken} />
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGate>
  );
}
