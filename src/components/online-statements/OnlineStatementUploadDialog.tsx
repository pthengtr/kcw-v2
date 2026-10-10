"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  isOnlineStatementFormat,
  ONLINE_STATEMENT_FORMATS,
  shopsForFormat,
  type OnlineStatementFormat,
} from "@/lib/online-statements/workbook";

const FORMAT_LABEL: Record<OnlineStatementFormat, string> = {
  lazada: "Lazada",
  shopee: "Shopee",
  tiktok: "TikTok",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded?: () => void;
};

export default function OnlineStatementUploadDialog({ open, onOpenChange, onUploaded }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [format, setFormat] = useState<OnlineStatementFormat>("lazada");
  const [shop, setShop] = useState("LAZ1");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const shops = shopsForFormat(format);

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

  function chooseFormat(value: string) {
    if (!isOnlineStatementFormat(value)) return;
    setFormat(value);
    const nextShops = shopsForFormat(value);
    setShop(nextShops[0] ?? "");
    setMessage(null);
    setIsError(false);
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
      const body = new FormData();
      body.set("format", format);
      body.set("shop", shop);
      body.set("file", file);
      const res = await fetch("/api/online-statements/upload", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) {
        setIsError(true);
        setMessage(json.error ?? "อัปโหลดไม่สำเร็จ");
        return;
      }
      setIsError(false);
      setMessage(`รับไฟล์แล้ว ${json.filename} · ${json.rowCount} แถว · กำลังจับคู่`);
      onUploaded?.();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>อัปโหลดสเตทเมนต์ออนไลน์</DialogTitle>
          <DialogDescription>
            เลือกรูปแบบแล้วอัปโหลดไฟล์ .xlsx สูงสุด 15 MB ไฟล์ที่ไม่ตรงรูปแบบจะไม่ถูกบันทึก
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="online-format">รูปแบบ</Label>
            <Select value={format} onValueChange={chooseFormat} disabled={uploading}>
              <SelectTrigger id="online-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ONLINE_STATEMENT_FORMATS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {FORMAT_LABEL[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="online-shop">ร้าน</Label>
            <Select value={shop} onValueChange={setShop} disabled={uploading}>
              <SelectTrigger id="online-shop">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {shops.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="online-file">ไฟล์ Excel</Label>
            <Input
              id="online-file"
              ref={fileRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={uploading}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
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
            <p className={isError ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
              {message}
            </p>
          ) : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={uploading} onClick={() => handleOpenChange(false)}>
            ปิด
          </Button>
          <Button type="button" disabled={uploading} onClick={() => void handleUpload()}>
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            อัปโหลด
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
