"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import {
  defaultBankStatementReportMonth,
  downloadFromSignedUrl,
  formatBankStatementReportMessage,
  invokeBankStatementReport,
  parseReportMonth,
  type BankStatementReportResult,
} from "@/lib/bank/statement-report";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated?: (result: BankStatementReportResult) => void;
};

export default function StatementReportDialog({
  open,
  onOpenChange,
  onGenerated,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [month, setMonth] = useState(defaultBankStatementReportMonth);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  function resetForm() {
    setMonth(defaultBankStatementReportMonth());
    setMessage(null);
    setIsError(false);
    setGenerating(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next && generating) return;
    if (!next) resetForm();
    onOpenChange(next);
  }

  async function handleGenerate() {
    const parsed = parseReportMonth(month);
    if (!parsed) {
      setIsError(true);
      setMessage("เลือกเดือนเป็น YYYY-MM");
      return;
    }

    setGenerating(true);
    setMessage(null);
    setIsError(false);
    try {
      const outcome = await invokeBankStatementReport({
        supabase,
        year: parsed.year,
        month: parsed.month,
      });
      if (!outcome.ok) {
        setIsError(true);
        setMessage(outcome.message);
        return;
      }

      const result = outcome.result;
      setMessage(formatBankStatementReportMessage(result));
      onGenerated?.(result);

      if (result.signed_url) {
        downloadFromSignedUrl(
          result.signed_url,
          result.filename ??
            `bank_statement_report_${parsed.year}_${String(parsed.month).padStart(2, "0")}.xlsx`
        );
      }
      onOpenChange(false);
    } catch (e) {
      setIsError(true);
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>สร้างรายงานเดินบัญชี</DialogTitle>
          <DialogDescription>
            สร้างไฟล์ Excel หลายชีต (บัญชีละชีต) จาก statement +
            สถานะจับคู่ แล้วดาวน์โหลดจาก Storage — ไม่ใช้ Google Drive
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="report-month">เดือนรายงาน</Label>
            <Input
              id="report-month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              disabled={generating}
            />
          </div>
          {message ? (
            <p
              className={`text-sm ${
                isError ? "text-destructive" : "text-muted-foreground"
              }`}
            >
              {message}
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={generating}
          >
            ยกเลิก
          </Button>
          <Button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={generating || !month}
          >
            {generating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="mr-2 h-4 w-4" />
            )}
            สร้างและดาวน์โหลด
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
