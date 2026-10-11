export type OnlineUploadStatus = "pending" | "applied" | "rejected" | string;

export function uploadStatusLabel(status: OnlineUploadStatus): string {
  if (status === "pending") return "รอเครื่อง HQ";
  if (status === "applied") return "เข้ารายงานแล้ว";
  if (status === "rejected") return "ไม่เข้ารายงาน";
  return status;
}

/** Worker message when the temp file was named `*.upload` and openpyxl refused it. */
export function describeUploadFailure(error: string | null | undefined): string | null {
  const text = error?.trim() ?? "";
  if (!text) return null;
  if (text.includes(".upload file format")) {
    return "รับไฟล์แล้ว แต่เครื่อง HQ เปิดไฟล์ไม่สำเร็จ จึงยังไม่ขึ้นในรายงาน";
  }
  return text;
}
