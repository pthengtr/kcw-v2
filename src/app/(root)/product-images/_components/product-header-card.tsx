import { PackageSearch } from "lucide-react";
import type { ProductInfo } from "../types";

function slotsLabel(product: ProductInfo | null) {
  return product ? "พบข้อมูลสินค้า" : "BCODE mode";
}

export function ProductHeaderCard({
  bcode,
  product,
}: {
  bcode: string;
  product: ProductInfo | null;
}) {
  if (!bcode) {
    return (
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3 text-slate-500">
          <PackageSearch className="h-5 w-5" />
          <p>กรอกรหัสสินค้าเพื่อเริ่มจัดการรูป</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">รหัสสินค้า</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            {bcode}
          </h2>
        </div>

        <div className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
          {slotsLabel(product)}
        </div>
      </div>

      {product ? (
        <div className="mt-4 space-y-2">
          <p className="text-lg font-medium text-slate-900">
            {product.DESCR || "-"}
          </p>

          <div className="flex flex-wrap gap-2 text-sm text-slate-600">
            {product.MODEL ? (
              <span className="rounded-full bg-slate-100 px-3 py-1">
                MODEL: {product.MODEL}
              </span>
            ) : null}

            {product.BRAND ? (
              <span className="rounded-full bg-slate-100 px-3 py-1">
                BRAND: {product.BRAND}
              </span>
            ) : null}

            {product.PRICE1 != null ? (
              <span className="rounded-full bg-slate-100 px-3 py-1">
                ราคา: {Number(product.PRICE1).toLocaleString("th-TH")}
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-amber-700">
          ไม่พบสินค้าใน public.v_pos_products_hq
          แต่ยังสามารถดู/จัดการรูปตามรหัสนี้ได้
        </p>
      )}
    </div>
  );
}
