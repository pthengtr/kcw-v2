"use client";

import {
  ResizablePanel,
  ResizablePanelGroup,
  ResizableHandle,
} from "@/components/ui/resizable";

import { useState } from "react";
import { ReminderType } from "@/components/reminder/ReminderColumn";
import ReminderTable from "@/components/reminder/ReminderTable";
import ReminderDetail from "@/components/reminder/ReminderDetail";

export default function Reminder() {
  const [selectedRow, setSelectedRow] = useState<ReminderType>();

  return (
    <section className="h-[90vh]">
      <ResizablePanelGroup
        className="grid grid-cols-2 w-full"
        direction="horizontal"
      >
        <ResizablePanel>
          <div className="h-full overflow-auto">
            <ReminderTable setSelectedRow={setSelectedRow} />
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel className="overflow-y-auto" defaultSize={30}>
          <div className="h-full overflow-auto">
            {selectedRow && <ReminderDetail selectedRow={selectedRow} />}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </section>
  );
}
