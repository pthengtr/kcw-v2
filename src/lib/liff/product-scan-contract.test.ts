import { describe, expect, it } from "vitest";

import {
  formatProductScanCallback,
  parseProductScanCallback,
  PRODUCT_SCAN_CALLBACK_PREFIX,
  sanitizeBarcode,
} from "@/lib/liff/product-scan-contract";
import {
  beginSubmit,
  canAcceptScan,
  markError,
  markSent,
  resetSubmit,
} from "@/lib/liff/scan-submit";

describe("product-scan-contract", () => {
  it("formats the LINE callback message", () => {
    expect(formatProductScanCallback("8851234567890")).toBe(
      "📦 สแกนสินค้า: 8851234567890"
    );
    expect(PRODUCT_SCAN_CALLBACK_PREFIX).toBe("📦 สแกนสินค้า:");
  });

  it("parses callback messages", () => {
    expect(parseProductScanCallback("📦 สแกนสินค้า: 22010585")).toBe(
      "22010585"
    );
    expect(parseProductScanCallback("สแกนสินค้า: ABC-1")).toBe("ABC-1");
    expect(parseProductScanCallback("hello")).toBeNull();
  });

  it("sanitizes barcodes", () => {
    expect(sanitizeBarcode(" 22010585 ")).toBe("22010585");
    expect(sanitizeBarcode("bad code")).toBeNull();
    expect(sanitizeBarcode("")).toBeNull();
  });
});

describe("scan-submit duplicate protection", () => {
  it("accepts first scan only", () => {
    const idle = resetSubmit();
    expect(canAcceptScan(idle, "123")).toBe(true);

    const submitting = beginSubmit(idle, "123");
    expect(submitting).toEqual({ status: "submitting", barcode: "123" });
    expect(canAcceptScan(submitting!, "123")).toBe(false);
    expect(beginSubmit(submitting!, "456")).toBeNull();

    const sent = markSent("123");
    expect(canAcceptScan(sent, "123")).toBe(false);
    expect(canAcceptScan(markError("123", "fail"), "999")).toBe(true);
  });
});
