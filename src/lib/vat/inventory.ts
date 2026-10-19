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
  sale_price: number | null;
  cost_billno: string | null;
  balance: number;
  supplier: string;
};

export type VatInventoryExportMovement = VatInventoryMovement & {
  bcode: string;
  descr: string;
};

export type VatInventoryExport = {
  products: VatInventoryRow[];
  movements: VatInventoryExportMovement[];
};

export const VAT_MOVEMENT_KIND_LABEL: Record<string, string> = {
  OPEN: "ยกมา",
  PI: "ซื้อ VAT",
  RV: "RV",
  SALE: "ขาย VAT",
  TAR: "TAR",
  SA: "ปรับสต็อก",
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

const EXPORT_PAGE_SIZE = 5000;

export async function loadVatInventoryExport(
  search: string,
  bcode: string
): Promise<VatInventoryExport> {
  const supabase = await createClient();
  const products: VatInventoryExport["products"] = [];
  const movements: VatInventoryExport["movements"] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.rpc("fn_vat_inventory_export", {
      p_search: search,
      p_bcode: bcode,
      p_limit: EXPORT_PAGE_SIZE,
      p_offset: offset,
    });
    if (error) throw new Error(error.message);
    const page = data as VatInventoryExport;
    if (offset === 0) products.push(...(page.products ?? []));
    const rows = page.movements ?? [];
    movements.push(...rows);
    if (rows.length < EXPORT_PAGE_SIZE) break;
    offset += EXPORT_PAGE_SIZE;
  }
  return { products, movements };
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
