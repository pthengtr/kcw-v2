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

export default function PoStatusPage() {
  const [tab, setTab] = useState<"hq" | "syp">("syp");
  const [refreshToken, setRefreshToken] = useState(0);
  const [meta, setMeta] = useState<PoMeta | null>(null);
  const [inventoryMeta, setInventoryMeta] = useState<InventoryMeta | null>(
    null
  );
  const [metaError, setMetaError] = useState<string | null>(null);
  const [syncingSite, setSyncingSite] = useState<PoSyncSite | null>(null);
  const [inventorySyncing, setInventorySyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inventoryPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      };
      setMeta(data.meta);
      setInventoryMeta(data.inventory);
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
      if (inventoryPollRef.current) clearInterval(inventoryPollRef.current);
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setSyncingSite(null);
  }, []);

  const stopInventoryPolling = useCallback(() => {
    if (inventoryPollRef.current) {
      clearInterval(inventoryPollRef.current);
      inventoryPollRef.current = null;
    }
    setInventorySyncing(false);
  }, []);

  const startPolling = useCallback(
    (site: PoSyncSite, jobId: number) => {
      stopPolling();
      setSyncingSite(site);
      setSyncMessage(`กำลัง sync ${site} (job #${jobId})…`);

      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/po/sync/${jobId}`, {
            cache: "no-store",
          });
          if (!res.ok) return;
          const data = (await res.json()) as { job: JobQueueRow };
          const status = data.job.status;
          if (status === "done") {
            stopPolling();
            setSyncMessage(`Sync ${site} สำเร็จ`);
            refresh();
          } else if (status === "failed") {
            stopPolling();
            setSyncMessage(
              data.job.error_message || `Sync ${site} ล้มเหลว`
            );
            refresh();
          }
        } catch {
          // keep polling
        }
      }, 2000);
    },
    [refresh, stopPolling]
  );

  const startInventoryPolling = useCallback(
    (jobs: JobQueueRow[]) => {
      stopInventoryPolling();
      const jobIds = jobs.map((j) => j.id);
      if (jobIds.length === 0) return;

      setInventorySyncing(true);
      setSyncMessage(
        `กำลัง sync สต็อก HQ+SYP (job ${jobIds.map((id) => `#${id}`).join(", ")})…`
      );

      const pending = new Map(
        jobIds.map((id) => [id, "pending" as string])
      );

      inventoryPollRef.current = setInterval(async () => {
        try {
          await Promise.all(
            jobIds.map(async (jobId) => {
              if (
                pending.get(jobId) === "done" ||
                pending.get(jobId) === "failed"
              ) {
                return;
              }
              const res = await fetch(`/api/po/inventory-sync/${jobId}`, {
                cache: "no-store",
              });
              if (!res.ok) return;
              const data = (await res.json()) as { job: JobQueueRow };
              pending.set(jobId, data.job.status);
              if (data.job.status === "failed") {
                pending.set(
                  jobId,
                  `failed:${data.job.error_message || "failed"}`
                );
              }
            })
          );

          const values = [...pending.values()];
          const allTerminal = values.every(
            (s) => s === "done" || s.startsWith("failed")
          );
          if (!allTerminal) return;

          stopInventoryPolling();
          const failed = values.filter((s) => s.startsWith("failed"));
          if (failed.length === 0) {
            setSyncMessage("Sync สต็อก สำเร็จ");
          } else {
            const msgs = failed
              .map((s) => s.replace(/^failed:?/, "") || "ล้มเหลว")
              .join("; ");
            setSyncMessage(`Sync สต็อก ล้มเหลว: ${msgs}`);
          }
          refresh();
        } catch {
          // keep polling
        }
      }, 2000);
    },
    [refresh, stopInventoryPolling]
  );

  // Resume polling if meta already has in-flight job for active site
  useEffect(() => {
    if (!meta || syncingSite) return;
    const site: PoSyncSite = tab === "hq" ? "HQ" : "SYP";
    const job = meta[site]?.inFlightJob;
    if (job) {
      startPolling(site, job.id);
    }
  }, [meta, tab, syncingSite, startPolling]);

  // Resume inventory polling if meta already has in-flight inventory jobs
  useEffect(() => {
    if (!inventoryMeta || inventorySyncing) return;
    if (inventoryMeta.inFlightJobs.length > 0) {
      startInventoryPolling(inventoryMeta.inFlightJobs);
    }
  }, [inventoryMeta, inventorySyncing, startInventoryPolling]);

  async function handleSync(site: PoSyncSite) {
    setSyncMessage(null);
    setSyncingSite(site);
    try {
      const res = await fetch("/api/po/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site }),
      });
      const body = await res.json().catch(() => ({}));

      if (res.status === 409 && body?.job?.id) {
        setSyncMessage(`มี sync ${site} กำลังรันอยู่แล้ว`);
        startPolling(site, body.job.id as number);
        return;
      }

      if (res.status === 503) {
        setSyncingSite(null);
        setSyncMessage(body?.error ?? `Worker ${site} offline`);
        return;
      }

      if (!res.ok) {
        setSyncingSite(null);
        setSyncMessage(body?.error ?? `Sync failed (${res.status})`);
        return;
      }

      const jobId = body?.job?.id as number;
      startPolling(site, jobId);
    } catch (e) {
      setSyncingSite(null);
      setSyncMessage(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleInventorySync() {
    setSyncMessage(null);
    setInventorySyncing(true);
    try {
      const res = await fetch("/api/po/inventory-sync", { method: "POST" });
      const body = await res.json().catch(() => ({}));

      if (res.status === 409 && Array.isArray(body?.jobs) && body.jobs.length) {
        setSyncMessage("มี sync สต็อก กำลังรันอยู่แล้ว");
        startInventoryPolling(body.jobs as JobQueueRow[]);
        return;
      }

      if (res.status === 503) {
        setInventorySyncing(false);
        setSyncMessage(body?.error ?? "Worker offline");
        return;
      }

      if (!res.ok) {
        setInventorySyncing(false);
        setSyncMessage(body?.error ?? `Inventory sync failed (${res.status})`);
        return;
      }

      const jobs = (body?.jobs ?? []) as JobQueueRow[];
      startInventoryPolling(jobs);
    } catch (e) {
      setInventorySyncing(false);
      setSyncMessage(e instanceof Error ? e.message : String(e));
    }
  }

  const activeSite: PoSyncSite = tab === "hq" ? "HQ" : "SYP";
  const siteMeta = meta?.[activeSite] ?? null;
  const inventoryInFlight =
    inventorySyncing || (inventoryMeta?.inFlightJobs.length ?? 0) > 0;

  const headerHint = useMemo(() => {
    if (!siteMeta) return null;
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>อัปเดตล่าสุด: {formatPoTs(siteMeta.lastIngestedAt)}</span>
        <span>
          สต็อก HQ: {formatPoTs(inventoryMeta?.hqLastUpdatedAt ?? null)}
        </span>
        <Badge variant={siteMeta.workerOnline ? "secondary" : "outline"}>
          {siteMeta.workerName}{" "}
          {siteMeta.workerOnline ? "online" : "offline"}
        </Badge>
        {siteMeta.inFlightJob || syncingSite === activeSite ? (
          <Badge variant="outline">กำลัง sync…</Badge>
        ) : null}
        {inventoryInFlight ? (
          <Badge variant="outline">กำลัง sync สต็อก…</Badge>
        ) : null}
      </div>
    );
  }, [
    siteMeta,
    syncingSite,
    activeSite,
    inventoryMeta?.hqLastUpdatedAt,
    inventoryInFlight,
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
              onClick={() => handleSync(activeSite)}
              disabled={syncingSite === activeSite || !!siteMeta?.inFlightJob}
            >
              Sync {activeSite}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleInventorySync()}
              disabled={inventoryInFlight}
            >
              Inventory Sync
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
          <TabsList className="h-auto w-full flex-wrap justify-start sm:w-auto">
            <TabsTrigger value="syp">SYP (โอนจาก HQ)</TabsTrigger>
            <TabsTrigger value="hq">HQ (ซัพพลายเออร์)</TabsTrigger>
          </TabsList>

          <TabsContent value="syp" className="mt-4">
            <PoSypTab refreshToken={refreshToken} onChanged={refresh} />
          </TabsContent>
          <TabsContent value="hq" className="mt-4">
            <PoHqTab refreshToken={refreshToken} />
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGate>
  );
}
