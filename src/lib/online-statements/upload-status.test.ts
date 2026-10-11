import { describe, expect, it } from "vitest";

import { describeUploadFailure, uploadStatusLabel } from "@/lib/online-statements/upload-status";

describe("online statement upload status", () => {
  it("labels the queue states in Thai", () => {
    expect(uploadStatusLabel("pending")).toBe("รอเครื่อง HQ");
    expect(uploadStatusLabel("applied")).toBe("เข้ารายงานแล้ว");
    expect(uploadStatusLabel("rejected")).toBe("ไม่เข้ารายงาน");
  });

  it("translates the worker temp-file rejection", () => {
    expect(
      describeUploadFailure(
        "openpyxl does not support .upload file format, please check you can open it with Excel first. Supported formats are: .xlsx,.xlsm,.xltx,.xltm"
      )
    ).toBe("รับไฟล์แล้ว แต่เครื่อง HQ เปิดไฟล์ไม่สำเร็จ จึงยังไม่ขึ้นในรายงาน");
    expect(describeUploadFailure("ไฟล์ไม่ใช่ Lazada Transaction Overview")).toBe(
      "ไฟล์ไม่ใช่ Lazada Transaction Overview"
    );
    expect(describeUploadFailure(null)).toBeNull();
  });
});
