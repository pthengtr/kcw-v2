"use client";

import { useState } from "react";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Switch } from "@/components/ui/switch";
import type { PartyKind } from "./PartyProvider";

const FormSchema = z.object({
  party_code: z.string().trim().max(64).nullable().optional(),
  party_name: z.string().trim().min(1, "กรอกชื่อ"),
  kind: z.enum(["SUPPLIER", "CUSTOMER", "BOTH"]),
  is_active: z.boolean().optional(),
});

export default function PartyFormDialog({
  open,
  onOpenChange,
  mode,
  party,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: "create" | "edit";
  party?: {
    party_uuid: string;
    party_code: string | null;
    party_name: string;
    kind: PartyKind;
    is_active: boolean;
  };
  onSubmit: (values: z.infer<typeof FormSchema>) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

  const defaults = party ?? {
    party_code: null,
    party_name: "",
    kind: "SUPPLIER" as PartyKind,
    is_active: true,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "เพิ่มคู่ค้า" : "แก้ไขคู่ค้า"}
          </DialogTitle>
        </DialogHeader>

        <form
          id="party-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (saving) return;
            setSaving(true);
            try {
              const fd = new FormData(e.currentTarget);
              const values = {
                party_code:
                  ((fd.get("party_code") as string) || "").trim() || null,
                party_name: ((fd.get("party_name") as string) || "").trim(),
                kind: (fd.get("kind") as PartyKind) ?? "SUPPLIER",
                is_active: fd.get("is_active") === "on",
              };
              const parsed = FormSchema.safeParse(values);
              if (!parsed.success) {
                alert(parsed.error.issues[0].message);
                return;
              }
              await onSubmit(parsed.data);
              onOpenChange(false);
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="party_name">ชื่อ</Label>
                <Input name="party_name" defaultValue={defaults.party_name} />
              </div>
              <div>
                <Label htmlFor="party_code">โค้ด</Label>
                <Input
                  name="party_code"
                  defaultValue={defaults.party_code ?? ""}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>ประเภท</Label>
                <Select
                  defaultValue={defaults.kind}
                  onValueChange={(v) => {
                    const hidden = document.getElementById(
                      "kind-hidden"
                    ) as HTMLInputElement;
                    hidden.value = v;
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SUPPLIER">SUPPLIER</SelectItem>
                    <SelectItem value="CUSTOMER">CUSTOMER</SelectItem>
                    <SelectItem value="BOTH">BOTH</SelectItem>
                  </SelectContent>
                </Select>
                {/* Hidden input so the Select value submits via FormData */}
                <input
                  id="kind-hidden"
                  name="kind"
                  type="hidden"
                  defaultValue={defaults.kind}
                />
              </div>

              <div className="flex items-center gap-2 mt-6">
                <Switch
                  id="is_active"
                  name="is_active"
                  defaultChecked={!!defaults.is_active}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            ยกเลิก
          </Button>
          <Button type="submit" form="party-form" disabled={saving}>
            {saving ? "กำลังบันทึก…" : mode === "create" ? "บันทึก" : "อัปเดต"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
