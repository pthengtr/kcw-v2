"use client";

import { useState } from "react";

import PoPendingReceiveTab, {
  PO_ICLOW_STATUS_TABS,
} from "@/components/po/PoPendingReceiveTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PoPendingReceiveStatus } from "@/lib/po/po-queries";

export default function PoHqTab({ refreshToken }: { refreshToken: number }) {
  const [view, setView] = useState<PoPendingReceiveStatus>("to_be_ordered");

  return (
    <div className="flex flex-col gap-3">
      <Tabs
        value={view}
        onValueChange={(v) => setView(v as PoPendingReceiveStatus)}
      >
        <TabsList className="h-auto w-full flex-wrap justify-start sm:w-auto">
          {PO_ICLOW_STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {PO_ICLOW_STATUS_TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-3">
            <PoPendingReceiveTab
              site="HQ"
              status={tab.value}
              refreshToken={refreshToken}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
