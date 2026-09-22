"use client";

import { useMemo, useState } from "react";
import { Coins, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBaht, formatBangkokDateTime } from "@/lib/bank/tiger-pay-format";
import type { TigerPayCashSnapshot } from "@/lib/bank/tiger-pay-daily";
import { cn } from "@/lib/utils";

const LEVEL_CLASS: Record<string, string> = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
  orange: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
  red: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
};

function itemKindLabel(item: { type?: string; value: number }): string {
  return item.type === "Coin" || (item.type == null && item.value < 20)
    ? "เหรียญ"
    : "ธนบัตร";
}

function sortByValueDesc(
  items: TigerPayCashSnapshot["items"]
): TigerPayCashSnapshot["items"] {
  return [...items].sort((a, b) => b.value - a.value);
}

function HopperItemsTable({
  items,
  showLineTotal = false,
}: {
  items: TigerPayCashSnapshot["items"];
  showLineTotal?: boolean;
}) {
  const colCount = showLineTotal ? 4 : 3;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-muted-foreground">
          <th className="py-1">ชนิด</th>
          <th className="py-1">มูลค่า</th>
          <th className="py-1 text-right">จำนวน</th>
          {showLineTotal ? (
            <th className="py-1 text-right">รวม</th>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {items.length === 0 ? (
          <tr>
            <td colSpan={colCount} className="py-3 text-muted-foreground">
              ไม่มีรายการ
            </td>
          </tr>
        ) : (
          items.map((item, index) => (
            <tr key={`${item.value}-${index}`} className="border-t">
              <td className="py-1">{itemKindLabel(item)}</td>
              <td className="py-1">{item.value}</td>
              <td className="py-1 text-right">{item.amount}</td>
              {showLineTotal ? (
                <td className="py-1 text-right tabular-nums">
                  {formatBaht(item.value * item.amount)}
                </td>
              ) : null}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

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

  const changeItems = useMemo(
    () => sortByValueDesc(hopper?.items ?? []),
    [hopper?.items]
  );
  const cashboxItems = useMemo(
    () => sortByValueDesc(hopper?.cash_box_items ?? []),
    [hopper?.cash_box_items]
  );
  const reasons = hopper?.change_reasons ?? [];

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
            <DialogTitle>สถานะเงินในเครื่อง</DialogTitle>
            <DialogDescription>
              {hopper
                ? `${formatBangkokDateTime(hopper.captured_at)} · ${hopper.trigger}`
                : "ยังไม่มี snapshot จาก kcw-api"}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="cashbox" className="flex flex-col gap-3">
            <TabsList className="w-fit">
              <TabsTrigger value="cashbox">เงินในตู้</TabsTrigger>
              <TabsTrigger value="change">เงินทอน</TabsTrigger>
            </TabsList>

            <TabsContent value="cashbox" className="mt-0 grid gap-3">
              <div className="rounded-md border bg-muted/40 px-3 py-3">
                <div className="text-xs text-muted-foreground">
                  เงินคงเหลือในตู้
                </div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">
                  {hopper ? formatBaht(hopper.cash_box_total_baht) : "—"}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                ยอดจากกล่องรับเงินในเครื่อง ไม่ใช่เงินทอนใน recycler
              </p>
              <HopperItemsTable items={cashboxItems} showLineTotal />
            </TabsContent>

            <TabsContent value="change" className="mt-0 grid gap-3">
              {hopper?.change_ready === false ? (
                <p className="text-sm text-rose-700">เครื่องแจ้งว่าทอนเงินไม่ได้</p>
              ) : hopper ? (
                <p className="text-sm text-muted-foreground">{label}</p>
              ) : null}
              {reasons.length > 0 ? (
                <ul className="list-disc pl-5 text-sm text-muted-foreground">
                  {reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : hopper ? (
                <p className="text-sm text-muted-foreground">
                  ไม่มีคำเตือนระดับเงินทอน
                </p>
              ) : null}
              <HopperItemsTable items={changeItems} />
            </TabsContent>
          </Tabs>

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
