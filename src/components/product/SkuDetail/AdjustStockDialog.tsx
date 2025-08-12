// components/sku/dialogs/AdjustStockDialog.tsx
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
  location_uuid: z.string().uuid(),
  domain: z.enum(["TAXED", "NONTAX"]),
  qty_delta: z.coerce
    .number()
    .refine((n) => n !== 0, "Quantity cannot be zero"),
  memo: z.string().optional(),
});
type Values = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sku_uuid: string;
  onSaved?: () => void; // refresh detail
};

type LocationRow = {
  location_uuid: string;
  location_code: string;
  location_name: string;
};

export default function AdjustStockDialog({
  open,
  onOpenChange,
  sku_uuid,
  onSaved,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [locations, setLocations] = useState<LocationRow[]>([]);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { domain: "TAXED", qty_delta: 1 },
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("location")
        .select("location_uuid, location_code, location_name")
        .eq("is_active", true)
        .order("location_code", { ascending: true });
      setLocations(data ?? []);
    })();
  }, [supabase]);

  async function onSubmit(values: Values) {
    const { error } = await supabase.rpc("fn_adjust_stock", {
      in_location_uuid: values.location_uuid,
      in_sku_uuid: sku_uuid,
      in_domain: values.domain,
      in_qty_delta: values.qty_delta, // positive = add, negative = remove
      in_memo: values.memo ?? null,
    });

    if (error) {
      // TODO: toast error
      console.error(error);
      return;
    }
    onOpenChange(false);
    onSaved?.();
  }

  const {
    register,
    handleSubmit,
    setValue,
    formState: { isSubmitting },
  } = form;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          ปรับสต็อกสินค้า
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Location</Label>
              <Select onValueChange={(v) => setValue("location_uuid", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.location_uuid} value={l.location_uuid}>
                      {l.location_code} — {l.location_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Domain</Label>
              <Select
                defaultValue="TAXED"
                onValueChange={(v) =>
                  setValue("domain", v as "TAXED" | "NONTAX")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TAXED">TAXED</SelectItem>
                  <SelectItem value="NONTAX">NONTAX</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantity (+/-)</Label>
              <Input type="number" step="0.01" {...register("qty_delta")} />
            </div>
            <div className="col-span-2">
              <Label>Memo</Label>
              <Input
                type="text"
                placeholder="Reason / note"
                {...register("memo")}
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
