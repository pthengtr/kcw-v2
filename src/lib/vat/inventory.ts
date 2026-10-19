import { createClient } from "@/lib/supabase/server";

export type VatInventorySummary = {
  products: number;
  qty: number;
  value: number;
  rebuilt_at: string | null;
};

export type VatSite = "all" | "hq" | "syp";

export function vatSite(value: string | undefined): VatSite {
  if (value === "all" || value === "hq" || value === "syp") return value;
  return "hq";
}

export function vatYear(value: string | undefined, years: number[]): number {
  const parsed = Number(value);
  if (years.includes(parsed)) return parsed;
  return years.length ? years[years.length - 1] : 2026;
}

export type VatInventoryRow = {
  bcode: string;
  site: VatSite;
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
  tf_qty: number;
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
  ref_billno?: string | null;
  balance: number;
  supplier: string;
};

export type VatInventoryExportMovement = VatInventoryMovement & {
  bcode: string;
  descr: string;
};

export type VatInventoryExport = {
  products: VatInventoryRow[];
  layers: VatInventoryLayer[];
  movements: VatInventoryExportMovement[];
};

/** Sales, TAR, and stock adjustments reduce on-hand, so the report shows them negative. */
export function deductQty(value: number): number {
  return -value;
}

export const VAT_MOVEMENT_KIND_LABEL: Record<string, string> = {
  OPEN: "ยกมา",
  PI: "ซื้อ VAT",
  RV: "RV",
  SALE: "ขาย VAT",
  TAR: "TAR",
  SA: "ปรับสต็อก",
  TF: "โอน",
  CN: "ใบลดหนี้",
};

export function isCreditNoteBill(billno: string | null | undefined): boolean {
  const bill = (billno || "").trim().toUpperCase();
  return (
    bill.startsWith("3CNTAR") ||
    bill.startsWith("CNTAR") ||
    bill.startsWith("3CNTAD") ||
    bill.startsWith("CNTAD") ||
    bill.startsWith("3CN") ||
    bill.startsWith("CN")
  );
}

export function movementKindLabel(kind: string, billno: string | null | undefined): string {
  if (isCreditNoteBill(billno)) return VAT_MOVEMENT_KIND_LABEL.CN;
  return VAT_MOVEMENT_KIND_LABEL[kind] ?? kind;
}

export type VatInventoryDetail = {
  product: VatInventoryRow & { rebuilt_at?: string };
  layers: VatInventoryLayer[];
  movements: VatInventoryMovement[];
};

const PAGE_SIZE = 100;

export async function loadVatInventoryYears(): Promise<number[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_vat_inventory_years");
  if (error) throw new Error(error.message);
  const years = (data as number[] | null) ?? [];
  return years.length ? years : [2026];
}

export async function loadVatInventorySummary(
  site: VatSite,
  year: number
): Promise<VatInventorySummary> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_vat_inventory_summary", {
    p_site: site,
    p_year: year,
  });
  if (error) throw new Error(error.message);
  return data as VatInventorySummary;
}

export async function loadVatInventoryProducts(
  search: string,
  offset: number,
  site: VatSite,
  year: number
): Promise<VatInventoryList> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_vat_inventory_products", {
    p_search: search,
    p_limit: PAGE_SIZE,
    p_offset: offset,
    p_site: site,
    p_year: year,
  });
  if (error) throw new Error(error.message);
  return data as VatInventoryList;
}

const EXPORT_PAGE_SIZE = 5000;

export async function loadVatInventoryExport(
  search: string,
  bcode: string,
  site: VatSite,
  year: number
): Promise<VatInventoryExport> {
  const supabase = await createClient();
  const products: VatInventoryExport["products"] = [];
  const layers: VatInventoryExport["layers"] = [];
  const movements: VatInventoryExport["movements"] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.rpc("fn_vat_inventory_export", {
      p_search: search,
      p_bcode: bcode,
      p_limit: EXPORT_PAGE_SIZE,
      p_offset: offset,
      p_site: site,
      p_year: year,
    });
    if (error) throw new Error(error.message);
    const page = data as VatInventoryExport;
    if (offset === 0) {
      products.push(...(page.products ?? []));
      layers.push(...(page.layers ?? []));
    }
    const rows = page.movements ?? [];
    movements.push(...rows);
    if (!bcode || rows.length < EXPORT_PAGE_SIZE) break;
    offset += EXPORT_PAGE_SIZE;
  }
  return { products, layers, movements };
}

export async function loadVatInventoryProduct(
  bcode: string,
  site: VatSite,
  year: number
): Promise<VatInventoryDetail> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_vat_inventory_product", {
    p_bcode: bcode,
    p_site: site,
    p_year: year,
  });
  if (error) throw new Error(error.message);
  return data as VatInventoryDetail;
}

export const VAT_INVENTORY_PAGE_SIZE = PAGE_SIZE;
