import { describe, expect, it, vi } from "vitest";

import { sanitizeBarcode } from "@/lib/liff/product-scan-contract";

describe("sanitizeBarcode used by scanner", () => {
  it("accepts typical product codes", () => {
    expect(sanitizeBarcode("22010585")).toBe("22010585");
    expect(sanitizeBarcode("8851234567890")).toBe("8851234567890");
    expect(sanitizeBarcode("*ABC123*")).toBe("ABC123");
  });
});

describe("pickBestDetectedCode", () => {
  it("prefers the larger centered barcode", async () => {
    const { pickBestDetectedCode } = await import("@/lib/liff/barcode-scanner");
    const code = pickBestDetectedCode(
      [
        {
          rawValue: "999",
          boundingBox: { x: 0, y: 0, width: 20, height: 10 },
        },
        {
          rawValue: "16052911",
          boundingBox: { x: 400, y: 200, width: 240, height: 60 },
        },
      ],
      1000,
      500
    );
    expect(code).toBe("16052911");
  });
});

describe("drawImageCenterCrop", () => {
  it("center-crops the image for zoomed decode passes", async () => {
    const { drawImageCenterCrop } = await import("@/lib/liff/barcode-scanner");
    const drawImage = vi.fn();
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
    } as unknown as HTMLCanvasElement;
    const img = {
      naturalWidth: 1000,
      naturalHeight: 500,
      width: 1000,
      height: 500,
    } as unknown as HTMLImageElement;

    expect(drawImageCenterCrop(img, canvas, 2)).toBe(true);
    expect(canvas.width).toBe(500);
    expect(canvas.height).toBe(250);
    expect(drawImage).toHaveBeenCalledWith(
      img,
      250,
      125,
      500,
      250,
      0,
      0,
      500,
      250
    );
  });
});

describe("decodeBarcodeFromImageFile", () => {
  it("rejects non-image files", async () => {
    const { decodeBarcodeFromImageFile } = await import(
      "@/lib/liff/barcode-scanner"
    );
    const file = new File(["x"], "note.txt", { type: "text/plain" });
    await expect(decodeBarcodeFromImageFile(file)).rejects.toThrow(
      /รูปภาพ/
    );
  });
});
