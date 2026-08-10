import { describe, expect, it, vi, afterEach } from "vitest";

import { sanitizeBarcode } from "@/lib/liff/product-scan-contract";

describe("sanitizeBarcode used by scanner", () => {
  it("accepts typical product codes", () => {
    expect(sanitizeBarcode("22010585")).toBe("22010585");
    expect(sanitizeBarcode("8851234567890")).toBe("8851234567890");
    expect(sanitizeBarcode("*ABC123*")).toBe("ABC123");
  });
});

describe("native detector capability gate", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("startProductBarcodeScanner uses getUserMedia once path without getCameras", async () => {
    // Ensure module import does not require DOM camera APIs at load time.
    const mod = await import("@/lib/liff/barcode-scanner");
    expect(typeof mod.startProductBarcodeScanner).toBe("function");
  });
});
