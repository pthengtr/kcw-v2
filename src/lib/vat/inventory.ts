import { createClient } from "@/lib/supabase/server";

export type VatInventorySummary = {
  products: number;
  qty: number;
  value: number;
  rebuilt_at: string | null;
};

export type VatInventoryRow = {
  bcode: string;
  descr: string;
  qty: number;
  value: number;
  uncovered_qty: number;
  open_qty: number;
  purchase_qty: number;
  rv_qty: number;
  sale_qty: number;
  tar_qty: number;
  sa_qty: number;
  actual_qty: number;
};

export type VatInventoryList = {
  total: number;
  rows: VatInventoryRow[];
};

export type VatInventoryLayer = {
  source: string;
  billno: string;
  billdate: string;
  supplier: string;
  site: string;
  qty: number;
  unit_cost: number;
};

export type VatInventoryMovement = {
  billdate: string;
  billno: string;
  kind: string;
  site: string;
  qty: number;
  unit_cost: number | null;
  balance: number;
  supplier: string;
};

export type VatInventoryDetail = {
  product: VatInventoryRow & { rebuilt_at?: string };
  layers: VatInventoryLayer[];
  movements: VatInventoryMovement[];
};

const PAGE_SIZE = 100;

export async function loadVatInventorySummary(): Promise<VatInventorySummary> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_vat_inventory_summary");
  if (error) throw new Error(error.message);
  return data as VatInventorySummary;
}

export async function loadVatInventoryProducts(
  search: string,
  offset: number
): Promise<VatInventoryList> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_vat_inventory_products", {
    p_search: search,
    p_limit: PAGE_SIZE,
    p_offset: offset,
  });
  if (error) throw new Error(error.message);
  return data as VatInventoryList;
}

export async function loadVatInventoryProduct(
  bcode: string
): Promise<VatInventoryDetail> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_vat_inventory_product", {
    p_bcode: bcode,
  });
  if (error) throw new Error(error.message);
  return data as VatInventoryDetail;
}

export const VAT_INVENTORY_PAGE_SIZE = PAGE_SIZE;
