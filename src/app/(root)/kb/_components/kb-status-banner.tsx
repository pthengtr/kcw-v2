import type { KbStatusState } from "../types";

export function KbStatusBanner({
  created,
  saved,
  deleted,
  image_uploaded,
  image_deleted,
  error,
}: KbStatusState) {
  if (error) {
    let message = "เกิดข้อผิดพลาดบางอย่าง";

    if (error === "create_failed") message = "สร้าง FAQ ไม่สำเร็จ";
    else if (error === "update_failed") message = "บันทึก FAQ ไม่สำเร็จ";
    else if (error === "delete_failed") message = "ลบ FAQ ไม่สำเร็จ";
    else if (error === "invalid_id") message = "รหัส FAQ ไม่ถูกต้อง";
    else if (error === "invalid_delete_id")
      message = "รหัสสำหรับลบ FAQ ไม่ถูกต้อง";
    else if (error === "title_required") message = "กรุณากรอกชื่อ FAQ";
    else if (error === "content_required") message = "กรุณากรอกเนื้อหา FAQ";
    else if (error === "no_images_selected")
      message = "กรุณาเลือกรูปภาพอย่างน้อย 1 รูป";
    else if (error === "invalid_image_type")
      message = "อัปโหลดได้เฉพาะไฟล์รูปภาพเท่านั้น";
    else if (error === "image_upload_failed")
      message = "อัปโหลดรูปภาพไม่สำเร็จ";
    else if (error === "image_delete_failed") message = "ลบรูปภาพไม่สำเร็จ";
    else if (error === "invalid_image_delete")
      message = "คำขอลบรูปภาพไม่ถูกต้อง";

    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {message}
      </div>
    );
  }

  if (created) {
    return (
      <div className="rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm text-green-700 dark:text-green-400">
        สร้าง FAQ เรียบร้อยแล้ว
      </div>
    );
  }

  if (saved) {
    return (
      <div className="rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm text-green-700 dark:text-green-400">
        บันทึก FAQ เรียบร้อยแล้ว
      </div>
    );
  }

  if (deleted) {
    return (
      <div className="rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm text-green-700 dark:text-green-400">
        ลบ FAQ เรียบร้อยแล้ว
      </div>
    );
  }

  if (image_uploaded) {
    return (
      <div className="rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm text-green-700 dark:text-green-400">
        อัปโหลดรูปภาพเรียบร้อยแล้ว
      </div>
    );
  }

  if (image_deleted) {
    return (
      <div className="rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm text-green-700 dark:text-green-400">
        ลบรูปภาพเรียบร้อยแล้ว
      </div>
    );
  }

  return null;
}
