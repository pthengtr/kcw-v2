import {
  Camera,
  ImageIcon,
  PackageSearch,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import type { ProductImageSlot, ProductInfo } from "../types";
import {
  deleteProductImageSlotAction,
  replaceProductImageSlotAction,
  searchProductImageAction,
  uploadProductImageAutoAction,
} from "../actions";
import Image from "next/image";

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

function formatDate(value: string | null) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleString("th-TH", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

function formatSize(value: number | null) {
  if (!value) return "-";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function getStatusText(status: ProductImageAdminScreenProps["status"]) {
  if (status.error) {
    const map: Record<string, string> = {
      missing_bcode: "กรุณาระบุรหัสสินค้า",
      no_file: "กรุณาเลือกรูปภาพก่อนอัปโหลด",
      invalid_file_type: "รองรับเฉพาะไฟล์รูปภาพเท่านั้น",
      invalid_slot: "ช่องรูปภาพไม่ถูกต้อง",
      invalid_delete: "รายการลบรูปไม่ถูกต้อง",
      upload_failed: "อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่",
      delete_failed: "ลบรูปไม่สำเร็จ กรุณาลองใหม่",
      no_slot: "ไม่พบช่องสำหรับอัปโหลดรูป",
    };

    return {
      tone: "error" as const,
      text: map[status.error] ?? "เกิดข้อผิดพลาด กรุณาลองใหม่",
    };
  }

  if (status.saved) {
    const modeText =
      status.mode === "replaced_oldest"
        ? "แทนรูปที่เก่าสุดแล้ว"
        : status.mode === "filled_empty"
          ? "เติมช่องว่างแล้ว"
          : "บันทึกรูปแล้ว";

    return {
      tone: "success" as const,
      text: `บันทึกรูปช่อง ${status.slot || "-"} สำเร็จ (${modeText})`,
    };
  }

  if (status.deleted) {
    return {
      tone: "success" as const,
      text: `ลบรูปช่อง ${status.slot || "-"} แล้ว`,
    };
  }

  return null;
}

function ProductHeader({
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

function slotsLabel(product: ProductInfo | null) {
  return product ? "พบข้อมูลสินค้า" : "BCODE mode";
}

function UploadAutoCard({ bcode }: { bcode: string }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-slate-100 p-3">
          <Upload className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold">เพิ่มรูปแบบอัตโนมัติ</h3>
          <p className="text-sm text-slate-500">
            เติมช่องว่างก่อน ถ้าครบ 5 รูปแล้วจะแทนรูปที่เก่าสุด
          </p>
        </div>
      </div>

      <form action={uploadProductImageAutoAction} className="mt-4 space-y-3">
        <input type="hidden" name="bcode" value={bcode} />
        <input
          type="file"
          name="image"
          accept="image/*"
          className="block w-full rounded-xl border border-dashed p-3 text-sm"
          required
        />
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-white"
        >
          <Camera className="h-4 w-4" />
          เพิ่มรูป
        </button>
      </form>
    </div>
  );
}

function ProductImageSlotCard({
  bcode,
  slot,
}: {
  bcode: string;
  slot: ProductImageSlot;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 className="font-semibold">{slot.label}</h3>
          <p className="text-xs text-slate-500">{slot.filename}</p>
        </div>

        {slot.isOldest ? (
          <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">
            เก่าสุด
          </span>
        ) : null}
      </div>

      <div className="bg-slate-50 p-3">
        {slot.exists && slot.publicUrl ? (
          <a href={slot.publicUrl} target="_blank" rel="noreferrer">
            <div className="relative aspect-square w-full overflow-hidden rounded-xl border bg-white">
              <Image
                src={slot.publicUrl}
                alt={`${bcode} ${slot.label}`}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 20vw"
                className="object-contain"
              />
            </div>
          </a>
        ) : (
          <div className="flex aspect-square w-full flex-col items-center justify-center rounded-xl border border-dashed bg-white text-slate-400">
            <ImageIcon className="h-10 w-10" />
            <p className="mt-2 text-sm">ยังไม่มีรูป</p>
          </div>
        )}
      </div>

      <div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
          <div>
            <p>อัปเดต</p>
            <p className="font-medium text-slate-700">
              {formatDate(slot.updatedAt)}
            </p>
          </div>
          <div>
            <p>ขนาด</p>
            <p className="font-medium text-slate-700">
              {formatSize(slot.size)}
            </p>
          </div>
        </div>

        <form action={replaceProductImageSlotAction} className="space-y-2">
          <input type="hidden" name="bcode" value={bcode} />
          <input type="hidden" name="path" value={slot.path} />
          <input type="hidden" name="slotNo" value={String(slot.slotNo)} />
          <input
            type="file"
            name="image"
            accept="image/*"
            className="block w-full rounded-xl border border-dashed p-2 text-xs"
            required
          />
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium"
          >
            <RefreshCw className="h-4 w-4" />
            {slot.exists ? "แทนที่" : "อัปโหลดช่องนี้"}
          </button>
        </form>

        {slot.exists ? (
          <form action={deleteProductImageSlotAction}>
            <input type="hidden" name="bcode" value={bcode} />
            <input type="hidden" name="path" value={slot.path} />
            <input type="hidden" name="slotNo" value={String(slot.slotNo)} />
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600"
            >
              <Trash2 className="h-4 w-4" />
              ลบ
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

export function ProductImageAdminScreen({
  bcode,
  product,
  slots,
  status,
}: ProductImageAdminScreenProps) {
  const statusText = getStatusText(status);

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">จัดการรูปสินค้า</h1>
        <p className="mt-2 text-sm text-slate-500">
          ใช้รูปจาก Supabase Storage: pictures/product/[BCODE]/[BCODE].jpg ถึง
          [BCODE]_4.jpg
        </p>
      </div>

      {statusText ? (
        <div
          className={
            statusText.tone === "error"
              ? "mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              : "mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
          }
        >
          {statusText.text}
        </div>
      ) : null}

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
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-white"
              >
                <PackageSearch className="h-4 w-4" />
                ค้นหา
              </button>
            </form>
          </div>

          <ProductHeader bcode={bcode} product={product} />

          {bcode ? <UploadAutoCard bcode={bcode} /> : null}
        </aside>

        <section className="space-y-4">
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

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
