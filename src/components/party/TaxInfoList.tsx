"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Party } from "./PartyProvider";
import { Trash2, Plus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

export default function TaxInfoList({
  party,
  onAdd,
  onDelete,
}: {
  party: Party;
  onAdd: (payload: {
    legal_name?: string | null;
    tax_payer_id?: string | null;
    address?: string | null;
  }) => Promise<void>;
  onDelete: (tax_info_uuid: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Tax Info</h4>
        <Button size="sm" onClick={() => setAdding((v) => !v)}>
          <Plus className="h-4 w-4 mr-1" /> เพิ่ม
        </Button>
      </div>

      {adding && (
        <AddTaxInfoForm
          onCancel={() => setAdding(false)}
          onSubmit={async (v) => {
            await onAdd(v);
            setAdding(false);
          }}
        />
      )}

      <div className="space-y-2">
        {party.tax_info.length === 0 ? (
          <p className="text-sm text-muted-foreground">— ไม่มีข้อมูล —</p>
        ) : (
          party.tax_info.map((t) => (
            <div key={t.tax_info_uuid} className="border rounded p-2">
              <div className="text-sm font-medium">{t.legal_name || "—"}</div>
              <div className="text-xs text-muted-foreground">
                Tax ID: {t.tax_payer_id || "—"}
              </div>
              {t.address && (
                <div className="text-xs whitespace-pre-wrap">{t.address}</div>
              )}
              <div className="mt-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onDelete(t.tax_info_uuid)}
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

function AddTaxInfoForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (payload: {
    legal_name?: string | null;
    tax_payer_id?: string | null;
    address?: string | null;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  return (
    <form
      className="grid gap-2 border rounded p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        await onSubmit({
          legal_name: ((fd.get("legal_name") as string) || "").trim() || null,
          tax_payer_id:
            ((fd.get("tax_payer_id") as string) || "").trim() || null,
          address: ((fd.get("address") as string) || "").trim() || null,
        });
        e.currentTarget.reset();
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Legal name</Label>
          <Input name="legal_name" />
        </div>
        <div>
          <Label>Tax ID</Label>
          <Input name="tax_payer_id" />
        </div>
      </div>
      <div>
        <Label>Address</Label>
        <Textarea name="address" rows={3} />
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
