"use client";

import {
  ResizablePanel,
  ResizablePanelGroup,
  ResizableHandle,
} from "@/components/ui/resizable";

import { useContext } from "react";
import ReminderTable from "@/components/reminder/ReminderTable";
import ReminderDetail from "@/components/reminder/ReminderDetail";
import {
  ReminderContext,
  ReminderContextType,
} from "@/components/reminder/ReminderProvider";

export default function Reminder() {
  const { selectedRow } = useContext(ReminderContext) as ReminderContextType;

  return (
    <section className="h-[90vh]">
      <ResizablePanelGroup
        className="grid grid-cols-2 w-full"
        direction="horizontal"
      >
        <ResizablePanel>
          <div className="h-full overflow-auto">
            <ReminderTable />
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel className="overflow-y-auto" defaultSize={30}>
          <div className="h-full overflow-auto">
            {selectedRow && <ReminderDetail />}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </section>
  );
}
