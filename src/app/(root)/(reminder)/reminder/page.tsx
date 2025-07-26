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
import { createClient } from "@/lib/supabase/client";

export default function Reminder() {
  const { selectedRow, setIsAdmin } = useContext(
    ReminderContext
  ) as ReminderContextType;

  const [paginationPageSize, setPaginationPageSize] = useState<
    number | undefined
  >();
  const [columnVisibility, setColumnVisibility] = useState<
    typeof defaultColumnVisibility | undefined
  >();

  useEffect(() => {
    async function getCookieColumnVisibility() {
      const data = await getMyCookie("reminderColumnVisibility");
      if (data) setColumnVisibility(JSON.parse(data));
      else setColumnVisibility(defaultColumnVisibility);
    }

    async function getPaginationPageSize() {
      const data = await getMyCookie("reminderPaginationPageSize");
      if (data) setPaginationPageSize(parseInt(data));
      else setPaginationPageSize(10);
    }

    async function checkUserAdmin() {
      const supabase = createClient();

      const {
        data: { user },
        error: errorUser,
      } = await supabase.auth.getUser();

      if (!user || errorUser) {
        console.log("No user logged in or error:", errorUser);
        return;
      }

      const query = supabase
        .from("kcw_admin")
        .select("*")
        .eq("user_id", user.email)
        .limit(500);

      const { data, error } = await query;

      if (error) {
        console.log("Cannot access kcw_admin table");
        return;
      }

      if (data && data.length > 0) {
        setIsAdmin(true);
      }
    }

    getCookieColumnVisibility();
    getPaginationPageSize();
    checkUserAdmin();
  }, [setIsAdmin]);

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
