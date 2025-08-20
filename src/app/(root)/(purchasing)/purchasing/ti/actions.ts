"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type TIHeaderInput = {
  ti_uuid?: string;
  supplier_uuid: string;
  location_uuid: string;
  ti_number?: string | null;
  ti_date: string; // yyyy-mm-dd
  header_discount_amount?: number;
  freight_amount?: number;
  other_charge_amount?: number;
  remark?: string | null;
  status?: "DRAFT" | "POSTED" | "VOID";
};

export type TILineInput = {
  ti_line_uuid?: string;
  line_no: number;
  sku_uuid: string;
  qty: number;
  unit_cost: number;
  line_discount_amount?: number;
  effective_tax_rate?: number;
};

export async function upsertTI(payload: {
  header: TIHeaderInput;
  lines: TILineInput[];
}) {
  const supabase = await createClient();
  const { header, lines } = payload;

  // upsert header (insert or update on ti_uuid)
  let ti_uuid = header.ti_uuid;

  if (!ti_uuid) {
    const { data, error } = await supabase
      .from("purchase_ti")
      .insert({
        supplier_uuid: header.supplier_uuid,
        location_uuid: header.location_uuid,
        ti_number: header.ti_number ?? null,
        ti_date: header.ti_date,
        header_discount_amount: header.header_discount_amount ?? 0,
        freight_amount: header.freight_amount ?? 0,
        other_charge_amount: header.other_charge_amount ?? 0,
        remark: header.remark ?? null,
      })
      .select("ti_uuid")
      .single();
    if (error) throw new Error(error.message);
    ti_uuid = data!.ti_uuid as string;
  } else {
    const { error } = await supabase
      .from("purchase_ti")
      .update({
        supplier_uuid: header.supplier_uuid,
        location_uuid: header.location_uuid,
        ti_number: header.ti_number ?? null,
        ti_date: header.ti_date,
        header_discount_amount: header.header_discount_amount ?? 0,
        freight_amount: header.freight_amount ?? 0,
        other_charge_amount: header.other_charge_amount ?? 0,
        remark: header.remark ?? null,
      })
      .eq("ti_uuid", ti_uuid);
    if (error) throw new Error(error.message);
  }

  // replace lines (simple strategy for phase 2)
  // delete then insert fresh (keeps line_no ordering straightforward)
  const { error: delErr } = await supabase
    .from("purchase_ti_line")
    .delete()
    .eq("ti_uuid", ti_uuid);
  if (delErr) throw new Error(delErr.message);

  if (lines.length > 0) {
    const rows = lines.map((l) => ({
      ti_uuid,
      line_no: l.line_no,
      sku_uuid: l.sku_uuid,
      qty: l.qty,
      unit_cost: l.unit_cost,
      line_discount_amount: l.line_discount_amount ?? 0,
      effective_tax_rate: l.effective_tax_rate ?? 0,
    }));
    const { error: insErr } = await supabase
      .from("purchase_ti_line")
      .insert(rows);
    if (insErr) throw new Error(insErr.message);
  }

  revalidatePath("/purchasing/ti");
  if (ti_uuid) revalidatePath(`/purchasing/ti/${ti_uuid}`);
  return { ti_uuid };
}

export async function postTI(ti_uuid: string, posted_by?: string | null) {
  const supabase = await createClient();
  // rely on SQL function to validate/compute totals
  const { error } = await supabase.rpc("fn_post_ti", {
    p_ti_uuid: ti_uuid,
    p_posted_by: posted_by ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/purchasing/ti");
  revalidatePath(`/purchasing/ti/${ti_uuid}`);
  return { ok: true };
}
