import { PackageSearch } from "lucide-react";

import type { ProductImageSlot, ProductInfo } from "../types";
import { searchProductImageAction } from "../actions";
import { PendingSubmitButton } from "./pending-submit-button";
import { ProductHeaderCard } from "./product-header-card";
import { ProductImageSlotCard } from "./product-image-slot-card";
import { ProductImageStatusAlert } from "./product-image-status-alert";
import { UploadAutoCard } from "./upload-auto-card";

type ProductImageAdminScreenProps = {
  bcode: string;
  product: ProductInfo | null;
  slots: ProductImageSlot[];
  status: {
    error: string;
    saved: boolean;
    deleted: boolean;
    slot: string;
    mode: string;
  };
};

export function ProductImageAdminScreen({
  bcode,
  product,
  slots,
  status,
}: ProductImageAdminScreenProps) {
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">จัดการรูปสินค้า</h1>
        <p className="mt-2 text-sm text-slate-500">
          ใช้รูปจาก Supabase Storage: pictures/product/[BCODE]/[BCODE].jpg ถึง
          [BCODE]_4.jpg
        </p>
      </div>

      <ProductImageStatusAlert status={status} />

      <section className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <aside className="space-y-5">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <form action={searchProductImageAction} className="space-y-3">
              <label className="text-sm font-medium text-slate-700">
                ค้นหารหัสสินค้า / BCODE
              </label>

              <input
                name="bcode"
                defaultValue={bcode}
                placeholder="เช่น 01010019"
                className="w-full rounded-xl border px-4 py-3 text-lg outline-none ring-slate-900/10 focus:ring-4"
                autoComplete="off"
              />

              <PendingSubmitButton
                pendingText="กำลังค้นหา..."
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-white"
              >
                <PackageSearch className="h-4 w-4" />
                ค้นหา
              </PendingSubmitButton>
            </form>
          </div>

          <ProductHeaderCard bcode={bcode} product={product} />

          {bcode ? <UploadAutoCard bcode={bcode} /> : null}
        </aside>

        <section className="min-w-0 space-y-4">
          {!bcode ? (
            <div className="rounded-2xl border bg-white p-8 text-center text-slate-500 shadow-sm">
              กรอกรหัสสินค้าเพื่อดูรูป 5 ช่อง
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">รูปสินค้า 5 ช่อง</h2>
                  <p className="text-sm text-slate-500">
                    เว็บแอปสามารถแทนที่/ลบทีละช่องได้ ส่วนปุ่มเพิ่มรูปจะใช้
                    logic เดียวกับ LINE
                  </p>
                </div>
              </div>

              <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
                {slots.map((slot) => (
                  <ProductImageSlotCard
                    key={slot.path}
                    bcode={bcode}
                    slot={slot}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      </section>
    </main>
  );
}
