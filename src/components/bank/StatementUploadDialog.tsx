"use client";

import { useMemo, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import {
  BANK_STATEMENT_ACCEPT,
  BANK_STATEMENT_BANKS,
  formatBankStatementImportMessage,
  invokeBankStatementImport,
  type BankStatementBankName,
  type BankStatementImportResult,
} from "@/lib/bank/statement-upload";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: (result: BankStatementImportResult) => void;
};

export default function StatementUploadDialog({
  open,
  onOpenChange,
  onImported,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [bankName, setBankName] = useState<BankStatementBankName>("KBANK");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  function resetForm() {
    setFile(null);
    setMessage(null);
    setIsError(false);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleOpenChange(next: boolean) {
    if (!next && uploading) return;
    if (!next) resetForm();
    onOpenChange(next);
  }

  async function handleUpload() {
    if (!file) {
      setIsError(true);
      setMessage("กรุณาเลือกไฟล์ Excel");
      return;
    }
    setUploading(true);
    setMessage(null);
    setIsError(false);
    try {
      const outcome = await invokeBankStatementImport({
        supabase,
        file,
        bankName,
      });
      if (!outcome.ok) {
        setIsError(true);
        setMessage(outcome.message);
        return;
      }
      setIsError(false);
      setMessage(formatBankStatementImportMessage(outcome.result));
      onImported?.(outcome.result);
    } catch (e) {
      setIsError(true);
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>อัปโหลด Statement</DialogTitle>
          <DialogDescription>
            เลือกธนาคารแล้วอัปโหลดไฟล์ Excel (.xlsx / .xls / .xlsm) — สูงสุด 15
            MB · ไฟล์ใบเดียวรองรับหลายแท็บ (หนึ่งแท็บต่อบัญชี)
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="bank-name">ธนาคาร</Label>
            <Select
              value={bankName}
              onValueChange={(v) => setBankName(v as BankStatementBankName)}
              disabled={uploading}
            >
              <SelectTrigger id="bank-name">
                <SelectValue placeholder="เลือกธนาคาร" />
              </SelectTrigger>
              <SelectContent>
                {BANK_STATEMENT_BANKS.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="statement-file">ไฟล์ Excel</Label>
            <Input
              id="statement-file"
              ref={fileRef}
              type="file"
              accept={BANK_STATEMENT_ACCEPT}
              disabled={uploading}
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setMessage(null);
                setIsError(false);
              }}
            />
            {file ? (
              <p className="text-xs text-muted-foreground">
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            ) : null}
          </div>

          {message ? (
            <p
              className={
                isError
                  ? "text-sm text-destructive"
                  : "text-sm text-muted-foreground"
              }
            >
              {message}
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => handleOpenChange(false)}
          >
            ปิด
          </Button>
          <Button type="button" disabled={uploading} onClick={handleUpload}>
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            อัปโหลด
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
