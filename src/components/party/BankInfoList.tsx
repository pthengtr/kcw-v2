"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Party, BankAccountType } from "./PartyProvider";
import { CheckCircle2, Plus, Star, Trash2 } from "lucide-react";
import { PartyBankLike } from "../common/BankAccountPicker";

export default function BankInfoList({
  party,
  onAdd,
  onDelete,
  onMakeDefault,
}: {
  party: Party;
  onAdd: (payload: {
    bank_name: string;
    bank_account_name: string;
    bank_account_number: string;
    bank_branch?: string | null;
    account_type?: BankAccountType;
    is_default?: boolean;
  }) => Promise<PartyBankLike>;
  onDelete: (bank_info_uuid: string) => Promise<void>;
  onMakeDefault: (bank_info_uuid: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Bank Accounts</h4>
        <Button size="sm" onClick={() => setAdding((v) => !v)}>
          <Plus className="h-4 w-4 mr-1" /> เพิ่ม
        </Button>
      </div>

      {adding && (
        <AddBankForm
          onCancel={() => setAdding(false)}
          onSubmit={async (v) => {
            await onAdd(v);
            setAdding(false);
          }}
        />
      )}

      <div className="space-y-2">
        {party.banks.length === 0 ? (
          <p className="text-sm text-muted-foreground">— ไม่มีข้อมูล —</p>
        ) : (
          party.banks.map((b) => (
            <div key={b.bank_info_uuid} className="border rounded p-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">
                  {b.bank_name} — {b.bank_account_name}
                </div>
                {b.is_default ? (
                  <span className="inline-flex items-center text-xs text-green-600">
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Default
                  </span>
                ) : null}
              </div>
              <div className="text-xs text-muted-foreground">
                เลขที่ {b.bank_account_number}{" "}
                {b.bank_branch ? `• สาขา ${b.bank_branch}` : ""} •{" "}
                {b.account_type}
              </div>
              <div className="mt-2 flex gap-2">
                {!b.is_default && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onMakeDefault(b.bank_info_uuid)}
                  >
                    <Star className="h-4 w-4 mr-1" /> ตั้งเป็นค่าเริ่มต้น
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onDelete(b.bank_info_uuid)}
                >
                  <Trash2 className="h-4 w-4 mr-1" /> ลบ
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AddBankForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (payload: {
    bank_name: string;
    bank_account_name: string;
    bank_account_number: string;
    bank_branch?: string | null;
    account_type?: BankAccountType;
    is_default?: boolean;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [acctType, setAcctType] = useState<BankAccountType>("OTHER");

  return (
    <form
      className="grid gap-2 border rounded p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        await onSubmit({
          bank_name: ((fd.get("bank_name") as string) || "").trim(),
          bank_account_name: (
            (fd.get("bank_account_name") as string) || ""
          ).trim(),
          bank_account_number: (
            (fd.get("bank_account_number") as string) || ""
          ).trim(),
          bank_branch: ((fd.get("bank_branch") as string) || "").trim() || null,
          account_type: acctType,
          is_default: fd.get("is_default") === "on",
        });
        e.currentTarget.reset();
      }}
    >
      <div className="grid md:grid-cols-2 gap-2">
        <div>
          <Label>ธนาคาร</Label>
          <Input name="bank_name" required />
        </div>
        <div>
          <Label>ชื่อบัญชี</Label>
          <Input name="bank_account_name" required />
        </div>
        <div>
          <Label>เลขที่บัญชี</Label>
          <Input name="bank_account_number" required />
        </div>
        <div>
          <Label>สาขา</Label>
          <Input name="bank_branch" />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-2 items-end">
        <div>
          <Label>ประเภทบัญชี</Label>
          <Select
            value={acctType}
            onValueChange={(v) => setAcctType(v as BankAccountType)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CHECKING">CHECKING</SelectItem>
              <SelectItem value="SAVINGS">SAVINGS</SelectItem>
              <SelectItem value="OTHER">OTHER</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="inline-flex items-center gap-2 mt-1">
          <input type="checkbox" name="is_default" className="h-4 w-4" />
          ตั้งเป็นค่าเริ่มต้น
        </label>
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm">
          บันทึก
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          ยกเลิก
        </Button>
      </div>
    </form>
  );
}
