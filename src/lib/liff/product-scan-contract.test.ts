import { describe, expect, it } from "vitest";

import {
  formatProductScanCallback,
  parseProductScanCallback,
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
  it("formats the LINE callback as a bare barcode", () => {
    expect(formatProductScanCallback("8851234567890")).toBe("8851234567890");
    expect(formatProductScanCallback(" 22010585 ")).toBe("22010585");
  });

  it("parses bare barcodes and legacy prefixed messages", () => {
    expect(parseProductScanCallback("22010585")).toBe("22010585");
    expect(parseProductScanCallback("📦 สแกนสินค้า: 22010585")).toBe(
      "22010585"
    );
    expect(parseProductScanCallback("สแกนสินค้า: ABC-1")).toBe("ABC-1");
    expect(parseProductScanCallback("hello")).toBeNull();
  });

  it("sanitizes barcodes", () => {
    expect(sanitizeBarcode(" 22010585 ")).toBe("22010585");
    expect(sanitizeBarcode("*22010585*")).toBe("22010585");
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
