"use client";

import { useState } from "react";
import { Coins, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatBangkokDateTime } from "@/lib/bank/tiger-pay-format";
import type { TigerPayCashSnapshot } from "@/lib/bank/tiger-pay-daily";
import { cn } from "@/lib/utils";

const LEVEL_CLASS: Record<string, string> = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
  orange: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
  red: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
};

export default function TigerPayHopperButton({
  hopper,
  onRefresh,
  refreshing,
}: {
  hopper: TigerPayCashSnapshot | null;
  onRefresh?: () => Promise<void> | void;
  refreshing?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const level = hopper?.change_level ?? "";
  const label =
    hopper?.change_ready === false
      ? "ทอนไม่ได้"
      : level === "red"
        ? "เงินทอนใกล้หมด"
        : level === "orange"
          ? "เงินทอนเริ่มน้อย"
          : hopper
            ? "เงินทอนพร้อม"
            : "สถานะเงินทอน";

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("shrink-0 gap-1", LEVEL_CLASS[level])}
        onClick={() => setOpen(true)}
        title={label}
      >
        {refreshing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Coins className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">{label}</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>สถานะเงินทอนในเครื่อง</DialogTitle>
            <DialogDescription>
              {hopper
                ? `${formatBangkokDateTime(hopper.captured_at)} · ${hopper.trigger}`
                : "ยังไม่มี snapshot จาก kcw-api"}
            </DialogDescription>
          </DialogHeader>
          {hopper?.change_ready === false ? (
            <p className="text-sm text-rose-700">เครื่องแจ้งว่าทอนเงินไม่ได้</p>
          ) : null}
          {(hopper?.change_reasons ?? []).length > 0 ? (
            <ul className="list-disc pl-5 text-sm text-muted-foreground">
              {(hopper?.change_reasons ?? []).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1">ชนิด</th>
                <th className="py-1">มูลค่า</th>
                <th className="py-1 text-right">จำนวน</th>
              </tr>
            </thead>
            <tbody>
              {(hopper?.items ?? []).length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-3 text-muted-foreground">
                    ไม่มีรายการ
                  </td>
                </tr>
              ) : (
                (hopper?.items ?? []).map((item, index) => (
                  <tr key={`${item.value}-${index}`} className="border-t">
                    <td className="py-1">{item.type === "Coin" || (item.type == null && item.value < 20) ? "เหรียญ" : "ธนบัตร"}</td>
                    <td className="py-1">{item.value}</td>
                    <td className="py-1 text-right">{item.amount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {onRefresh ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void onRefresh()}
              disabled={refreshing}
            >
              รีเฟรชจากเครื่อง
            </Button>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
