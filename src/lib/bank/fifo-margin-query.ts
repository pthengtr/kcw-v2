import { mergeBillFifo, parseBillFifoRows, type BillFifoCost } from "@/lib/bank/fifo-margin";
import { createAdminClient } from "@/lib/supabase/admin";

const CHUNK = 2000;

export async function loadSaleFifo(
  billnos: string[],
  site: "hq" | "syp" | null
): Promise<BillFifoCost[]> {
  const unique = [...new Set(billnos.map((bill) => bill.trim()).filter(Boolean))];
  if (unique.length === 0) return [];

  const supabase = createAdminClient();
  const chunks: string[][] = [];
  for (let index = 0; index < unique.length; index += CHUNK) {
    chunks.push(unique.slice(index, index + CHUNK));
  }

  const parts = await Promise.all(
    chunks.map(async (chunk) => {
      const args: { p_billnos: string[]; p_site?: string } = { p_billnos: chunk };
      if (site) args.p_site = site;
      const { data, error } = await supabase.rpc("fn_sale_fifo_by_bills", args);
      if (error) throw new Error(error.message);
      return parseBillFifoRows(data);
    })
  );
  return mergeBillFifo(parts.flat());
}
