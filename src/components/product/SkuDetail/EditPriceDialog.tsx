// components/sku/dialogs/EditPriceDialog.tsx
"use client";

import * as z from "zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

const schema = z.object({
  pack_uom_code: z.string().min(1), // 'EA','PK',...
  qty_per_pack: z.coerce.number().positive(),
  unit_price: z.coerce.number().nonnegative(),
});

type Values = z.infer<typeof schema>;
type UomRow = { uom_code: string; description: string | null };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sku_uuid: string;
  base_uom: string;
  initialPack?: { uom: string; qty: number };
  onSaved?: () => void;
};

export default function EditPriceDialog({
  open,
  onOpenChange,
  sku_uuid,
  base_uom,
  initialPack,
  onSaved,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [uoms, setUoms] = useState<UomRow[]>([]);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      pack_uom_code: initialPack?.uom ?? base_uom,
      qty_per_pack: initialPack?.qty ?? 1,
      unit_price: 0, // will be auto-filled from current price
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { isSubmitting },
  } = form;

  // Load UOMs once when dialog opens
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data, error } = await supabase
        .from("uom")
        .select("uom_code, description")
        .order("uom_code", { ascending: true });
      if (!error) setUoms((data as UomRow[]) ?? []);
    })();
  }, [open, supabase]);

  // Reset defaults when opening/target changes
  useEffect(() => {
    if (!open) return;
    reset({
      pack_uom_code: initialPack?.uom ?? base_uom,
      qty_per_pack: initialPack?.qty ?? 1,
      unit_price: 0,
    });
  }, [open, base_uom, initialPack?.uom, initialPack?.qty, reset]);

  // Autofill current price for (UOM, qty)
  const packUom = watch("pack_uom_code");
  const qtyPack = watch("qty_per_pack");
  useEffect(() => {
    if (!open) return;
    const uom = (packUom || base_uom).toUpperCase();
    const qty = Number(qtyPack || 1);

    (async () => {
      const { data, error } = await supabase
        .from("v_price_default")
        .select("unit_price")
        .eq("sku_uuid", sku_uuid)
        .eq("pack_uom_code", uom)
        .eq("qty_per_pack", qty)
        .limit(1);

      if (!error && data && data.length > 0) {
        const current = Number(data[0].unit_price);
        setValue("unit_price", Number.isNaN(current) ? 0 : current, {
          shouldDirty: false,
        });
      } else {
        setValue("unit_price", 0, { shouldDirty: false });
      }
    })();
  }, [open, packUom, qtyPack, base_uom, sku_uuid, supabase, setValue]);

  async function onSubmit(values: Values) {
    const { error } = await supabase.rpc("fn_set_price", {
      in_list_name: "DEFAULT", // fixed
      in_sku_uuid: sku_uuid,
      in_pack_uom_code: values.pack_uom_code.toUpperCase(),
      in_qty_per_pack: values.qty_per_pack,
      in_unit_price: values.unit_price,
      in_close_previous: true, // fixed
    });

    if (error) {
      console.error(error); // TODO: toast
      return;
    }
    onOpenChange(false);
    onSaved?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          แก้ไข/เพิ่มราคา
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit price</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {/* <div>
              <Label>Price list</Label>
              <Input value="DEFAULT" readOnly />
            </div> */}

            {/* Effective from removed — always today */}

            <div>
              <Label>Pack UOM</Label>
              <Select
                value={packUom || ""}
                onValueChange={(v) => setValue("pack_uom_code", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select UOM" />
                </SelectTrigger>
                <SelectContent>
                  {/* Base UOM on top */}
                  <SelectItem value={base_uom}>{base_uom}</SelectItem>
                  {uoms
                    .filter((u) => u.uom_code !== base_uom)
                    .map((u) => (
                      <SelectItem key={u.uom_code} value={u.uom_code}>
                        {u.uom_code}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Qty per pack</Label>
              <Input
                type="number"
                step="1"
                min="1"
                {...register("qty_per_pack")}
              />
            </div>

            <div className="col-span-2">
              <Label>Unit price (per pack)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                {...register("unit_price")}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
