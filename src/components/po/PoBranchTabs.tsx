"use client";

import type { ReactNode } from "react";

import PoPendingReceiveTab, {
  PO_ICLOW_STATUS_TABS,
} from "@/components/po/PoPendingReceiveTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PoPendingReceiveStatus } from "@/lib/po/po-queries";
import type { PoSyncSite } from "@/lib/po/worker-jobs";

export type PoBranchView = "list" | PoPendingReceiveStatus;

export default function PoBranchTabs({
  site,
  view,
  onViewChange,
  refreshToken,
  listContent,
}: {
  site: PoSyncSite;
  view: PoBranchView;
  onViewChange: (view: PoBranchView) => void;
  refreshToken: number;
  listContent: ReactNode;
}) {
  return (
    <Tabs value={view} onValueChange={(v) => onViewChange(v as PoBranchView)}>
      <TabsList
        className="h-auto w-fit max-w-full flex-wrap justify-start gap-1 p-1"
      >
        <TabsTrigger value="list">PO</TabsTrigger>
        <span
          className="mx-0.5 hidden h-5 w-px shrink-0 self-center bg-border sm:inline"
          aria-hidden
        />
        {PO_ICLOW_STATUS_TABS.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="list" className="mt-3">
        {listContent}
      </TabsContent>

      {PO_ICLOW_STATUS_TABS.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="mt-3">
          <PoPendingReceiveTab
            site={site}
            status={tab.value}
            refreshToken={refreshToken}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
