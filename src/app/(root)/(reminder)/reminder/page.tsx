"use client";

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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export default function Reminder() {
  const { selectedRow, setIsAdmin, setSelectedRow } = useContext(
    ReminderContext
  ) as ReminderContextType;

  const [paginationPageSize, setPaginationPageSize] = useState<
    number | undefined
  >();
  const [columnVisibility, setColumnVisibility] = useState<
    typeof defaultColumnVisibility | undefined
  >();

  useEffect(() => {
    async function getMyCookieClient<T>(
      tableName: string,
      defaultValues: T,
      setValues: (values: T) => void
    ) {
      const data = await getMyCookie(tableName);
      if (data) setValues(JSON.parse(data));
      else setValues(defaultValues);
    }

    async function getCookies() {
      await getMyCookieClient(
        "reminderColumnVisibility",
        defaultColumnVisibility,
        setColumnVisibility
      );
      await getMyCookieClient(
        "reminderPaginationPageSize",
        10,
        setPaginationPageSize
      );
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

    getCookies();
    checkUserAdmin();
  }, [setIsAdmin]);

  return (
    <section className="h-[90vh]">
      {/* Table now uses full width/height */}
      {columnVisibility && paginationPageSize && (
        <div className="h-[80vh] px-8">
          <ReminderTable
            columnVisibility={columnVisibility}
            paginationPageSize={paginationPageSize}
          />
        </div>
      )}

      {/* Right drawer for detail */}
      <Sheet
        open={!!selectedRow}
        onOpenChange={(open) => {
          if (!open) setSelectedRow?.(undefined);
        }}
      >
        {/* Keep padding zero so the detail component controls its layout */}
        <SheetContent
          side="right"
          className="w-full min-w-[80vw] p-8 overflow-auto"
        >
          {/* Visually hidden, satisfies a11y */}
          <SheetHeader className="sr-only">
            <SheetTitle>รายละเอียดการเตือนโอน</SheetTitle>
            <SheetDescription>
              ดู/แก้ไขรายละเอียดรายการเตือนโอน
            </SheetDescription>
          </SheetHeader>

          <div className="overflow-hidden relative">
            {selectedRow && <ReminderDetail />}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
