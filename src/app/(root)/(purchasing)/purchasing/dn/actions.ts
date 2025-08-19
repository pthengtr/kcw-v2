"use server";

import { createClient } from "@/lib/supabase/server"; // your server client
import { z } from "zod";

const Line = z.object({
  dn_line_uuid: z.string().uuid().optional(),
  line_no: z.number().int().positive(),
  sku_uuid: z.string().uuid(),
  qty: z.number().positive(),
  provisional_unit_cost: z.number().nullable().optional(),
});

const Header = z.object({
  dn_uuid: z.string().uuid().optional(),
  supplier_uuid: z.string().uuid(),
  location_uuid: z.string().uuid(),
  dn_number: z.string().optional().nullable(),
  dn_date: z.string(), // ISO date
  remark: z.string().optional().nullable(),
  domain_hint: z.enum(["TAXED", "NONTAX"]).default("TAXED"),
  lines: z.array(Line).min(1),
});

// app/purchasing/dn/actions.ts
export type DNFormData = {
  dn_uuid?: string;
  supplier_uuid: string;
  location_uuid: string;
  dn_number: string | null;
  dn_date: string; // yyyy-mm-dd
  remark: string | null;
  domain_hint: "TAXED" | "NONTAX";
  lines: Array<{
    dn_line_uuid?: string;
    line_no: number;
    sku_uuid: string;
    qty: number;
    provisional_unit_cost: number | null;
  }>;
};

export async function saveDraftDN(payload: DNFormData) {
  const supabase = await createClient();
  const data = Header.parse(payload);

  // upsert header
  let dn_uuid = data.dn_uuid ?? undefined;
  if (!dn_uuid) {
    const { data: ins, error } = await supabase
      .from("purchase_dn")
      .insert({
        supplier_uuid: data.supplier_uuid,
        location_uuid: data.location_uuid,
        dn_number: data.dn_number ?? null,
        dn_date: data.dn_date,
        remark: data.remark ?? null,
        domain_hint: data.domain_hint,
        status: "DRAFT",
      })
      .select("dn_uuid")
      .single();
    if (error) throw error;
    dn_uuid = ins!.dn_uuid;
  } else {
    const { error } = await supabase
      .from("purchase_dn")
      .update({
        supplier_uuid: data.supplier_uuid,
        location_uuid: data.location_uuid,
        dn_number: data.dn_number ?? null,
        dn_date: data.dn_date,
        remark: data.remark ?? null,
        domain_hint: data.domain_hint,
      })
      .eq("dn_uuid", dn_uuid);
    if (error) throw error;
    // wipe lines & reinsert (simplest for phase 1)
    await supabase.from("purchase_dn_line").delete().eq("dn_uuid", dn_uuid);
  }

  // insert lines
  const rows = data.lines.map((ln) => ({
    dn_uuid,
    line_no: ln.line_no,
    sku_uuid: ln.sku_uuid,
    qty: ln.qty,
    provisional_unit_cost: ln.provisional_unit_cost ?? null,
  }));
  const { error: lineErr } = await supabase
    .from("purchase_dn_line")
    .insert(rows);
  if (lineErr) throw lineErr;

  return { dn_uuid };
}

export async function postDN(dn_uuid: string) {
  const supabase = await createClient();
  // optional: check current status before post
  const { data: dn, error: dnErr } = await supabase
    .from("purchase_dn")
    .select("status")
    .eq("dn_uuid", dn_uuid)
    .single();
  if (dnErr) throw dnErr;
  if (dn?.status !== "DRAFT") {
    throw new Error("Only DRAFT documents can be posted.");
  }

  const { error } = await supabase.rpc("fn_post_dn", {
    p_dn_uuid: dn_uuid,
    p_posted_by: "web", // or current user
  });
  if (error) throw error;

  return { ok: true };
}
