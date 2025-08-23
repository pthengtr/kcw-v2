"use client";

import React, { useContext, useEffect, useMemo, useState } from "react";
import { ReminderContext, ReminderContextType } from "./ReminderProvider";
import ReminderFormDialog from "./ReminderFormDialog";
import CommonImagesCarousel from "../common/CommonImageCaroussel";
import CommonImageManagerDialog from "../common/CommonImageManagerDialog";
import { createClient } from "@/lib/supabase/client";
// import type { PaymentReminderRow } from "@/lib/types/models";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import {
  Pencil,
  Building2,
  CreditCard,
  Calendar,
  Receipt,
  CheckCircle2,
  CircleDashed,
  FileText,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PostgrestError } from "@supabase/supabase-js";

/* ---------------- types for joined data ---------------- */
type PartyMini = {
  party_uuid: string;
  party_name: string;
  party_code: string | null;
};

type BankMini = {
  bank_info_uuid: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  is_default: boolean;
};

/* ---------------- helpers ---------------- */
const fmtAmount = (n?: number | null) =>
  typeof n === "number"
    ? n.toLocaleString("th-TH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "—";

// const fmtDate = (s?: string | null) =>
//   s
//     ? new Date(s).toLocaleDateString("th-TH", {
//         day: "2-digit",
//         month: "2-digit",
//         year: "2-digit",
//       })
//     : "—";

const fmtDateTime = (s?: string | null) =>
  s
    ? new Date(s).toLocaleString("th-TH", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

function FieldRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-12 gap-2 py-1">
      <div className="col-span-4 md:col-span-3 text-muted-foreground">
        {label}
      </div>
      <div className={cn("col-span-8 md:col-span-9", mono && "font-mono")}>
        {value}
      </div>
    </div>
  );
}

type Props = {
  onDeleted?: (reminder_uuid: string) => void; // optional hook for parent to refresh/close
};
/* =======================================================
   MAIN
======================================================= */
export default function ReminderDetail({ onDeleted }: Props) {
  const { selectedRow, openUpdateDialog, setOpenUpdateDialog, setSelectedRow } =
    useContext(ReminderContext) as ReminderContextType;

  const supabase = useMemo(() => createClient(), []);
  const [party, setParty] = useState<PartyMini | null>(null);
  const [bank, setBank] = useState<BankMini | null>(null);

  const [deleting, setDeleting] = useState(false);

  function isPostgrestError(e: unknown): e is PostgrestError {
    return !!e && typeof e === "object" && "message" in e && "code" in e;
  }

  function errorMessage(e: unknown): string {
    if (typeof e === "string") return e;
    if (e instanceof Error) return e.message;
    if (isPostgrestError(e))
      return e.message || e.details || "Unexpected error";
    try {
      return JSON.stringify(e);
    } catch {
      return "Unexpected error";
    }
  }

  async function handleDelete() {
    if (!selectedRow) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("payment_reminder")
        .delete()
        .eq("reminder_uuid", selectedRow.reminder_uuid);

      if (error) throw error;

      // clear selection so the detail pane empties
      setSelectedRow?.(undefined);

      // let parent refresh list / close drawer
      onDeleted?.(selectedRow.reminder_uuid);
    } catch (e: unknown) {
      console.error("[delete reminder] failed", e);
      alert(errorMessage(e));
    } finally {
      setDeleting(false);
    }
  }
  // fetch joined details for prettier display
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selectedRow) return;
      // party
      if (selectedRow.party_uuid) {
        const { data } = await supabase
          .from("party")
          .select("party_uuid, party_name, party_code")
          .eq("party_uuid", selectedRow.party_uuid)
          .maybeSingle<PartyMini>();
        if (!cancelled) setParty(data ?? null);
      } else {
        setParty(null);
      }
      // bank
      if (selectedRow.bank_info_uuid) {
        const { data } = await supabase
          .from("party_bank_info")
          .select(
            "bank_info_uuid, bank_name, bank_account_name, bank_account_number, is_default"
          )
          .eq("bank_info_uuid", selectedRow.bank_info_uuid)
          .maybeSingle<BankMini>();
        if (!cancelled) setBank(data ?? null);
      } else {
        setBank(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    selectedRow,
    supabase,
    selectedRow?.party_uuid,
    selectedRow?.bank_info_uuid,
  ]);

  if (!selectedRow) {
    return (
      <div className="h-[80vh] grid place-items-center text-muted-foreground">
        ไม่มีข้อมูลที่เลือก
      </div>
    );
  }

  const isPaid = !!selectedRow.payment_date;
  const hasProof = !!selectedRow.proof_of_payment;
  const netAmount =
    (selectedRow.total_amount ?? 0) - (selectedRow.discount ?? 0);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* ===== Sticky header ===== */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b">
        <div className="flex items-center justify-between px-3 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <Receipt className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-lg font-semibold">
                {selectedRow.note_id || "—"}
              </span>
              <div className="flex items-center gap-2">
                <Badge
                  variant={isPaid ? "default" : "secondary"}
                  className="gap-1"
                >
                  {isPaid ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" /> จ่ายแล้ว
                    </>
                  ) : (
                    <>
                      <CircleDashed className="h-3.5 w-3.5" /> ค้างชำระ
                    </>
                  )}
                </Badge>
                {hasProof && <Badge variant="outline">มีหลักฐานโอน</Badge>}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <ReminderFormDialog
              update
              open={openUpdateDialog}
              setOpen={setOpenUpdateDialog}
              dialogTrigger={
                <Button size="sm" variant="outline" className="gap-2">
                  <Pencil className="h-4 w-4" />
                  แก้ไข
                </Button>
              }
              dialogHeader="แก้ไขรายการเตือนโอน"
            />

            {/* Delete with confirm */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4" />
                  ลบ
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>ลบรายการนี้หรือไม่?</AlertDialogTitle>
                  <AlertDialogDescription>
                    การลบจะไม่สามารถกู้คืนได้ คุณต้องการลบรายการเตือนโอนเลขที่{" "}
                    <span className="font-medium">{selectedRow.note_id}</span>{" "}
                    จริงหรือไม่ (คู่ค้า: {selectedRow.party_uuid})?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>
                    ยกเลิก
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? "กำลังลบ…" : "ลบรายการ"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      {/* ===== Top summary cards ===== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Party Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              คู่ค้า
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <FieldRow
              label="ชื่อคู่ค้า"
              value={party?.party_name ?? selectedRow.party_uuid}
            />
            <FieldRow
              label="รหัสคู่ค้า"
              value={party?.party_code ?? "—"}
              mono
            />
          </CardContent>
        </Card>

        {/* Bank Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              บัญชีธนาคาร
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <FieldRow label="ธนาคาร" value={bank?.bank_name ?? "—"} />
            <FieldRow
              label="ชื่อบัญชี"
              value={bank?.bank_account_name ?? "—"}
            />
            <FieldRow
              label="เลขที่บัญชี"
              value={bank?.bank_account_number ?? "—"}
              mono
            />
          </CardContent>
        </Card>

        {/* Amount Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-muted-foreground" />
              ยอดเงิน
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <FieldRow label="มูลค่ารวม" value={fmtAmount(netAmount)} />
              <FieldRow
                label="ส่วนลด"
                value={fmtAmount(selectedRow.discount)}
              />
              <Separator className="my-2" />
              <FieldRow
                label="สุทธิ"
                value={
                  <span className="font-semibold">
                    {fmtAmount(selectedRow.total_amount)}
                  </span>
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== Document & Dates ===== */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            รายละเอียดเอกสาร & วันเวลา
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <div className="space-y-1">
              <FieldRow
                label="เลขที่เอกสาร"
                value={selectedRow.note_id || "—"}
                mono
              />
              <FieldRow
                label="จำนวนใบ"
                value={selectedRow.bill_count?.toLocaleString("th-TH")}
              />
              <FieldRow label="ผู้บันทึก" value={selectedRow.user_id || "—"} />
              <FieldRow label="หมายเหตุ" value={selectedRow.remark || "—"} />
            </div>
            <div className="space-y-1">
              <FieldRow
                label="เริ่มต้น"
                value={fmtDateTime(selectedRow.start_date)}
              />
              <FieldRow
                label="สิ้นสุด"
                value={fmtDateTime(selectedRow.end_date)}
              />
              <FieldRow
                label="กำหนดชำระ"
                value={fmtDateTime(selectedRow.due_date)}
              />
              <FieldRow
                label="วันโอนจริง"
                value={fmtDateTime(selectedRow.payment_date)}
              />
              <FieldRow
                label="เข้า KBIZ"
                value={fmtDateTime(selectedRow.kbiz_datetime)}
              />
            </div>
          </div>

          <Separator className="my-4" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <FieldRow
              label="สร้างเมื่อ"
              value={fmtDateTime(selectedRow.created_at)}
            />
            <FieldRow
              label="แก้ไขเมื่อ"
              value={fmtDateTime(selectedRow.last_modified)}
            />
          </div>
        </CardContent>
      </Card>

      {/* ===== Images: Bill ===== */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">รูปบิล / ใบวางบิล</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3  grid place-content-center">
          <div className="w-full md:w-[420px]">
            <CommonImagesCarousel
              folder="public/reminder_bill"
              receiptUuid={selectedRow.reminder_uuid}
              bucket="pictures"
            />
          </div>
          <CommonImageManagerDialog
            folder="public/reminder_bill"
            receiptUuid={selectedRow.reminder_uuid}
            bucket="pictures"
          />
        </CardContent>
      </Card>

      {/* ===== Images: Payment Proof ===== */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">รูปหลักฐานการชำระเงิน</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 grid place-content-center">
          <div className="w-full md:w-[420px]">
            <CommonImagesCarousel
              folder="public/reminder_payment"
              receiptUuid={selectedRow.reminder_uuid}
              bucket="pictures"
            />
          </div>
          <CommonImageManagerDialog
            folder="public/reminder_payment"
            receiptUuid={selectedRow.reminder_uuid}
            bucket="pictures"
          />
        </CardContent>
      </Card>
    </div>
  );
}
