"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Party } from "./PartyProvider";
import { Trash2, Plus, PencilLine, X, Check } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

export default function TaxInfoList({
  party,
  onAdd,
  onUpdate,
  onDelete,
}: {
  party: Party;
  onAdd: (payload: {
    legal_name?: string | null;
    tax_payer_id?: string | null;
    address?: string | null;
  }) => Promise<void>;
  onUpdate: (
    tax_info_uuid: string,
    patch: {
      legal_name?: string | null;
      tax_payer_id?: string | null;
      address?: string | null;
    }
  ) => Promise<void>;
  onDelete: (tax_info_uuid: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">ข้อมูลผู้เสียภาษี</h4>
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
              {editingId === t.tax_info_uuid ? (
                <EditTaxInfoForm
                  initial={{
                    legal_name: t.legal_name ?? "",
                    tax_payer_id: t.tax_payer_id ?? "",
                    address: t.address ?? "",
                  }}
                  onCancel={() => setEditingId(null)}
                  onSubmit={async (v) => {
                    await onUpdate(t.tax_info_uuid, {
                      legal_name: v.legal_name.trim() || null,
                      tax_payer_id: v.tax_payer_id.trim() || null,
                      address: v.address.trim() || null,
                    });
                    setEditingId(null);
                  }}
                />
              ) : (
                <>
                  <div className="text-sm font-medium">
                    {t.legal_name || "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Tax ID: {t.tax_payer_id || "—"}
                  </div>
                  {t.address && (
                    <div className="text-xs whitespace-pre-wrap">
                      {t.address}
                    </div>
                  )}
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setEditingId(t.tax_info_uuid)}
                    >
                      <PencilLine className="h-4 w-4 mr-1" />
                      แก้ไข
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onDelete(t.tax_info_uuid)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> ลบ
                    </Button>
                  </div>
                </>
              )}
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
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget; // <-- keep a ref BEFORE await
    const fd = new FormData(formEl);
    await onSubmit({
      legal_name: ((fd.get("legal_name") as string) || "").trim() || null,
      tax_payer_id: ((fd.get("tax_payer_id") as string) || "").trim() || null,
      address: ((fd.get("address") as string) || "").trim() || null,
    });
    formEl.reset(); // <-- safe now
  };

  return (
    <form className="grid gap-2 border rounded p-3" onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>ชื่อผู้เสียภาษี</Label>
          <Input name="legal_name" />
        </div>
        <div>
          <Label>เลขประจำตัวผู้เสียภาษ๊</Label>
          <Input name="tax_payer_id" />
        </div>
      </div>
      <div>
        <Label>ที่อยู่</Label>
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

function EditTaxInfoForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: { legal_name: string; tax_payer_id: string; address: string };
  onSubmit: (payload: {
    legal_name: string;
    tax_payer_id: string;
    address: string;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  return (
    <form
      className="grid gap-2 border rounded p-3 bg-muted/30"
      onSubmit={async (e) => {
        e.preventDefault();
        await onSubmit(form);
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Legal name</Label>
          <Input
            value={form.legal_name}
            onChange={(e) =>
              setForm((f) => ({ ...f, legal_name: e.target.value }))
            }
          />
        </div>
        <div>
          <Label>Tax ID</Label>
          <Input
            value={form.tax_payer_id}
            onChange={(e) =>
              setForm((f) => ({ ...f, tax_payer_id: e.target.value }))
            }
          />
        </div>
      </div>
      <div>
        <Label>Address</Label>
        <Textarea
          rows={3}
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm">
          <Check className="h-4 w-4 mr-1" />
          บันทึก
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          <X className="h-4 w-4 mr-1" />
          ยกเลิก
        </Button>
      </div>
    </form>
  );
}
