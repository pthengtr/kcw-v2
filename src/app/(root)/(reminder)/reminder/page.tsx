"use client";

import {
  ResizablePanel,
  ResizablePanelGroup,
  ResizableHandle,
} from "@/components/ui/resizable";

import { useContext, useEffect, useState } from "react";
import ReminderTable, {
  defaultColumnVisibility,
} from "@/components/reminder/ReminderTable";
import ReminderDetail from "@/components/reminder/ReminderDetail";
import {
  ReminderContext,
  ReminderContextType,
} from "@/components/reminder/ReminderProvider";
import { getMyCookie } from "../../action";

export default function Reminder() {
  const { selectedRow } = useContext(ReminderContext) as ReminderContextType;

  const [paginationPageSize, setPaginationPageSize] = useState<
    number | undefined
  >();
  const [columnVisibility, setColumnVisibility] = useState<
    typeof defaultColumnVisibility | undefined
  >();

  useEffect(() => {
    async function getCookieColumnVisibility() {
      const data = await getMyCookie("columnVisibility");
      if (data) setColumnVisibility(JSON.parse(data));
      else setColumnVisibility(defaultColumnVisibility);
    }

    async function getPaginationPageSize() {
      const data = await getMyCookie("paginationPageSize");
      if (data) setPaginationPageSize(parseInt(data));
      else setPaginationPageSize(10);
    }

    getCookieColumnVisibility();
    getPaginationPageSize();
  }, []);

  console.log(columnVisibility);
  return (
    <section className="h-[90vh]">
      <ResizablePanelGroup
        className="grid grid-cols-2 w-full"
        direction="horizontal"
      >
        <ResizablePanel>
          {columnVisibility && paginationPageSize && (
            <div className="h-full overflow-auto">
              <ReminderTable
                columnVisibility={columnVisibility}
                paginationPageSize={paginationPageSize}
              />
            </div>
          )}
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
