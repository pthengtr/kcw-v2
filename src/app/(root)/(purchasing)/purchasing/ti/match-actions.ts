"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addTIMatch(params: {
  ti_line_uuid?: string;
  dn_line_uuid: string;
  qty_matched: number;
  unit_cost_at_match: number;
}) {
  const supabase = await createClient();
  const { ti_line_uuid, dn_line_uuid, qty_matched, unit_cost_at_match } =
    params;

  const { error } = await supabase.from("dn_ti_match").insert([
    {
      ti_line_uuid,
      dn_line_uuid,
      qty_matched,
      unit_cost_at_match,
    },
  ]);
  if (error) throw new Error(error.message);

  // Optional: if your edit page path is /purchasing/ti/[ti_uuid], revalidate caller page instead.
  revalidatePath("/purchasing/ti");
  return { ok: true };
}

export async function deleteTIMatch(match_uuid: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("dn_ti_match")
    .delete()
    .eq("match_uuid", match_uuid);
  if (error) throw new Error(error.message);
  revalidatePath("/purchasing/ti");
  return { ok: true };
}
