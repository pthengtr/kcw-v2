import { createClient } from "@/lib/supabase/server";
import TIFormShadcn, {
  type TIFormValue,
} from "@/components/purchasing/TIFormShadcn";
import { Params } from "next/dist/server/request/params";

// DB row types (minimal fields we actually use here)
type PurchaseTI = {
  ti_uuid: string;
  supplier_uuid: string;
  location_uuid: string;
  ti_number: string | null;
  ti_date: string; // "YYYY-MM-DD"
  header_discount_amount: number | null;
  freight_amount: number | null;
  other_charge_amount: number | null;
  status: "DRAFT" | "POSTED" | "VOID";
  // Optional if your table includes it; safe to keep optional here:
  remark?: string | null;
};

type PurchaseTILine = {
  ti_line_uuid: string;
  ti_uuid: string;
  line_no: number;
  sku_uuid: string;
  qty: number;
  unit_cost: number;
  line_discount_amount: number | null;
  effective_tax_rate: number | null;
};

function toNum(v: number | string | null | undefined, fallback = 0): number {
  if (v === null || v === undefined) return fallback;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? (n as number) : fallback;
}

export default async function EditTIPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { ti_uuid } = await params;
  const supabase = await createClient();

  // Header (select only used columns; cast to typed row)
  const { data: headerRow, error: hErr } = await supabase
    .from("purchase_ti")
    .select(
      "ti_uuid, supplier_uuid, location_uuid, ti_number, ti_date, header_discount_amount, freight_amount, other_charge_amount, status, remark"
    )
    .eq("ti_uuid", ti_uuid)
    .single();
  if (hErr) throw new Error(hErr.message);
  const header = headerRow as PurchaseTI;

  // Lines (typed)
  const { data: linesRows, error: lErr } = await supabase
    .from("purchase_ti_line")
    .select(
      "ti_line_uuid, ti_uuid, line_no, sku_uuid, qty, unit_cost, line_discount_amount, effective_tax_rate"
    )
    .eq("ti_uuid", ti_uuid)
    .order("line_no", { ascending: true });
  if (lErr) throw new Error(lErr.message);
  const lines = (linesRows ?? []) as PurchaseTILine[];

  const initial: TIFormValue = {
    header: {
      ti_uuid: header.ti_uuid,
      supplier_uuid: header.supplier_uuid,
      location_uuid: header.location_uuid,
      ti_number: header.ti_number ?? "",
      ti_date: header.ti_date,
      header_discount_amount: toNum(header.header_discount_amount),
      freight_amount: toNum(header.freight_amount),
      other_charge_amount: toNum(header.other_charge_amount),
      // If your table doesn't have `remark`, this stays as empty string
      remark: header.remark ?? "",
    },
    lines: lines.map((r) => ({
      ti_line_uuid: r.ti_line_uuid, // <- keep it
      line_no: r.line_no,
      sku_uuid: r.sku_uuid,
      qty: toNum(r.qty),
      unit_cost: toNum(r.unit_cost),
      line_discount_amount: toNum(r.line_discount_amount),
      effective_tax_rate: toNum(r.effective_tax_rate),
    })),
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Edit Tax Invoice</h1>
      <TIFormShadcn initial={initial} readOnly={header.status !== "DRAFT"} />
    </div>
  );
}
