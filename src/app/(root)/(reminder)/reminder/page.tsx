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
    <ResizablePanelGroup
      className="grid grid-cols-2 w-full"
      direction="horizontal"
    >
      <ResizablePanel>
        <ReminderTable setSelectedRow={setSelectedRow} />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={30}>
        {selectedRow && <ReminderDetail selectedRow={selectedRow} />}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
