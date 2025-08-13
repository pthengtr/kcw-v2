"use client";

import { useContext, useEffect, useState } from "react";
import { PosContext, PosContextType } from "./PosProvider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Trash2, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";

type Method = { pos_payment_method_code: string; description: string };

export default function PosPayments() {
  const { payments, addPayment, updatePayment, removePayment, paidTotal } =
    useContext(PosContext) as PosContextType;
  const [methods, setMethods] = useState<Method[]>([]);
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("pos_payment_method")
        .select("pos_payment_method_code,description")
        .order("pos_payment_method_code");
      setMethods((data ?? []) as Method[]);
    })();
  }, [supabase]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-base">ชำระเงิน</Label>
        <Button variant="outline" size="sm" onClick={addPayment}>
          <Plus className="w-4 h-4" /> เพิ่มช่องทาง
        </Button>
      </div>
      {payments.map((p) => (
        <div key={p.temp_id} className="grid grid-cols-12 gap-2 items-center">
          <div className="col-span-4">
            <Select
              value={p.pos_payment_method_code}
              onValueChange={(v) =>
                updatePayment(p.temp_id, { pos_payment_method_code: v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="วิธีชำระ" />
              </SelectTrigger>
              <SelectContent>
                {methods.map((m) => (
                  <SelectItem
                    key={m.pos_payment_method_code}
                    value={m.pos_payment_method_code}
                  >
                    {m.pos_payment_method_code} — {m.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-3">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={p.amount}
              onChange={(e) =>
                updatePayment(p.temp_id, { amount: Number(e.target.value) })
              }
              placeholder="จำนวนเงิน"
            />
          </div>
          <div className="col-span-4">
            <Input
              value={p.txn_ref ?? ""}
              onChange={(e) =>
                updatePayment(p.temp_id, { txn_ref: e.target.value })
              }
              placeholder="อ้างอิง (ถ้ามี)"
            />
          </div>
          <div className="col-span-1 flex justify-end">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removePayment(p.temp_id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ))}
      <div className="text-right text-sm text-muted-foreground">
        รวมชำระ:{" "}
        {paidTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท
      </div>
    </div>
  );
}
