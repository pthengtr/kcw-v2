"use client";

import { useMemo, useState } from "react";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import TableLoadingState from "@/components/common/TableLoadingState";
import {
  billedLabel,
  formatPoAmount,
  formatPoDate,
  formatPoTs,
} from "@/lib/po/format";
import type { PoHeaderRow, PoLineRow } from "@/lib/po/po-queries";

function formatHqLocation(
  location1: string | null | undefined,
  location2: string | null | undefined
): string {
  const loc1 = location1?.trim() || null;
  const loc2 = location2?.trim() || null;
  if (loc1 && loc2) return `${loc1}/${loc2}`;
  return loc1 ?? loc2 ?? "—";
}

export default function PoSypDetailDialog({
  open,
  onOpenChange,
  selected,
  lines,
  linesLoading,
  savingDocno,
  savingLine,
  noteDraft,
  onNoteDraftChange,
  onToggleHeaderPrepared,
  onSaveNote,
  onToggleLinePrepared,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: PoHeaderRow | null;
  lines: PoLineRow[];
  linesLoading: boolean;
  savingDocno: string | null;
  savingLine: string | null;
  noteDraft: string;
  onNoteDraftChange: (value: string) => void;
  onToggleHeaderPrepared: (prepared: boolean) => void;
  onSaveNote: () => void;
  onToggleLinePrepared: (line: PoLineRow, prepared: boolean) => void;
}) {
  const [printBusy, setPrintBusy] = useState(false);

  const preparedCount = useMemo(
    () => lines.filter((l) => l.prepared).length,
    [lines]
  );

  function handlePrint() {
    setPrintBusy(true);
    window.setTimeout(() => {
      window.print();
      setPrintBusy(false);
    }, 50);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[calc(100vw-1.5rem)] max-w-5xl max-h-[90dvh] overflow-y-auto print:max-w-none print:max-h-none print:w-auto print:border-0 print:shadow-none"
        data-po-print-root
      >
        <DialogHeader className="print:mb-2">
          <DialogTitle>SYP PO {selected?.docno}</DialogTitle>
        </DialogHeader>

        {selected ? (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div>
                  วันที่: {formatPoDate(selected.docdate)} · PARTS9:{" "}
                  {billedLabel(selected.billed)} · ยอด:{" "}
                  {formatPoAmount(selected.aftertax)}
                </div>
                <div className="text-muted-foreground">
                  เตรียมรายบรรทัด: {preparedCount}/{lines.length}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="print:hidden"
                disabled={printBusy || linesLoading || lines.length === 0}
                onClick={handlePrint}
              >
                <Printer className="h-4 w-4" />
                พิมพ์ตาราง
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3 print:hidden">
              <div className="flex items-center gap-2">
                <Switch
                  checked={Boolean(selected.prepared)}
                  disabled={savingDocno === selected.docno}
                  onCheckedChange={(checked) =>
                    onToggleHeaderPrepared(checked)
                  }
                />
                <span>เตรียมทั้งใบ</span>
              </div>
              {selected.prepared_at ? (
                <span className="text-muted-foreground">
                  {formatPoTs(selected.prepared_at)}
                </span>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center print:hidden">
              <Input
                placeholder="หมายเหตุ (ถ้ามี)"
                value={noteDraft}
                onChange={(e) => onNoteDraftChange(e.target.value)}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={savingDocno === selected.docno}
                onClick={onSaveNote}
              >
                บันทึกหมายเหตุ
              </Button>
            </div>
          </div>
        ) : null}

        {/* Plain overflow div (not ScrollArea): Radix viewport h-full causes blank print pages */}
        <div className="max-h-[55vh] overflow-auto rounded-md border print:max-h-none print:overflow-visible print:border-0">
          {linesLoading ? (
            <TableLoadingState label="กำลังโหลดรายการ…" />
          ) : (
            <table className="w-full min-w-[52rem] border-collapse text-sm print:min-w-0">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="w-14 p-2 text-center">เตรียม</th>
                  <th className="p-2">BCODE</th>
                  <th className="p-2">รายละเอียด</th>
                  <th className="p-2">ที่เก็บ HQ</th>
                  <th className="p-2">จำนวน</th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td className="p-2 text-muted-foreground" colSpan={5}>
                      ไม่มีรายการ
                    </td>
                  </tr>
                ) : (
                  lines.map((line, i) => {
                    const lineKey = line.line ?? String(i);
                    const busy =
                      savingLine === `${selected?.docno}:${lineKey}`;
                    return (
                      <tr key={`${lineKey}-${i}`} className="border-b">
                        <td className="p-2 text-center align-middle">
                          {/* Screen: interactive checkbox */}
                          <span className="inline-flex print:hidden">
                            <Checkbox
                              checked={Boolean(line.prepared)}
                              disabled={busy || !line.line}
                              onCheckedChange={(value) =>
                                onToggleLinePrepared(line, value === true)
                              }
                              aria-label={`เตรียมบรรทัด ${line.line ?? ""}`}
                            />
                          </span>
                          {/* Print: empty box for handwritten check */}
                          <span
                            aria-hidden
                            className="mx-auto hidden h-4 w-4 border border-black print:inline-block"
                          />
                        </td>
                        <td className="p-2">{line.bcode ?? "—"}</td>
                        <td className="p-2">{line.detail ?? "—"}</td>
                        <td className="p-2 font-medium">
                          {formatHqLocation(line.hq_location1, line.hq_location2)}
                        </td>
                        <td className="p-2">
                          {line.qty ?? "—"} {line.ui ?? ""}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        <style>{`
          @media print {
            @page { margin: 12mm; size: auto; }
            html, body {
              height: auto !important;
              overflow: visible !important;
              background: white !important;
            }
            /* DialogPortal uses asChild → Content is a direct body child (no portal wrapper).
               Hide every other body child so page chrome cannot create blank pages. */
            body > *:not([data-po-print-root]) {
              display: none !important;
            }
            [data-po-print-root] {
              position: static !important;
              inset: auto !important;
              left: auto !important;
              top: auto !important;
              width: 100% !important;
              max-width: none !important;
              max-height: none !important;
              height: auto !important;
              margin: 0 !important;
              padding: 0.5rem !important;
              transform: none !important;
              border: none !important;
              box-shadow: none !important;
              border-radius: 0 !important;
              background: white !important;
              overflow: visible !important;
              display: block !important;
            }
            [data-po-print-root] > button {
              display: none !important;
            }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
