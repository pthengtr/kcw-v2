type ProductImageStatus = {
  error: string;
  saved: boolean;
  deleted: boolean;
  slot: string;
  mode: string;
};

function getStatusText(status: ProductImageStatus) {
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

export function ProductImageStatusAlert({
  status,
}: {
  status: ProductImageStatus;
}) {
  const statusText = getStatusText(status);

  if (!statusText) return null;

  return (
    <div
      className={
        statusText.tone === "error"
          ? "mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          : "mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
      }
    >
      {statusText.text}
    </div>
  );
}
