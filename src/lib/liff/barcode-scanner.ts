/**
 * Static barcode decoding for LIFF product scan.
 *
 * Live WebView camera scanning is unreliable for small 1D stickers (soft AF).
 * Instead we open the system camera / gallery via <input capture|file>, then
 * decode the still image with BarcodeDetector (when available) or html5-qrcode.
 */

import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

import { sanitizeBarcode } from "@/lib/liff/product-scan-contract";

/** Formats used on KCW product stickers — avoid noisy symbologies (ITF/Codabar). */
const NATIVE_FORMATS = [
  "code_128",
  "code_39",
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "qr_code",
] as const;

const ZXING_FORMATS = [
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.QR_CODE,
];

type DetectedBarcode = {
  rawValue?: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
};

type BarcodeDetectorLike = {
  detect: (
    source: HTMLImageElement | ImageBitmap | HTMLCanvasElement
  ) => Promise<DetectedBarcode[]>;
};

type BarcodeDetectorCtor = {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
};

/**
 * When several codes appear (barcode + nearby label noise), prefer the largest
 * detection closest to the frame center.
 */
export function pickBestDetectedCode(
  codes: DetectedBarcode[],
  frameW: number,
  frameH: number
): string | null {
  const cx = frameW / 2;
  const cy = frameH / 2;
  let best: { code: string; score: number } | null = null;

  for (const item of codes) {
    const code = sanitizeBarcode(item.rawValue ?? null);
    if (!code) continue;

    const box = item.boundingBox;
    let score = code.length;
    if (box && frameW > 0 && frameH > 0) {
      const bx = box.x + box.width / 2;
      const by = box.y + box.height / 2;
      const dist = Math.hypot(bx - cx, by - cy);
      const area = Math.max(1, box.width * box.height);
      score = area / (1 + dist);
    }

    if (!best || score > best.score) {
      best = { code, score };
    }
  }

  return best?.code ?? null;
}

async function canUseNativeDetector(): Promise<boolean> {
  const Ctor = (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
    .BarcodeDetector;
  if (typeof Ctor !== "function") return false;
  try {
    if (typeof Ctor.getSupportedFormats === "function") {
      const supported = await Ctor.getSupportedFormats();
      return (
        supported.includes("code_128") ||
        supported.includes("ean_13") ||
        supported.includes("code_39")
      );
    }
    return true;
  } catch {
    return false;
  }
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("เปิดรูปภาพไม่สำเร็จ"));
    };
    img.src = url;
  });
}

/** Draw a center crop of the image at the given zoom into a canvas. */
export function drawImageCenterCrop(
  img: HTMLImageElement,
  canvas: HTMLCanvasElement,
  zoom: number
): boolean {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return false;

  const z = Math.max(1, zoom);
  const cropW = Math.max(2, Math.floor(iw / z));
  const cropH = Math.max(2, Math.floor(ih / z));
  const sx = Math.floor((iw - cropW) / 2);
  const sy = Math.floor((ih - cropH) / 2);

  canvas.width = cropW;
  canvas.height = cropH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;
  ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, cropW, cropH);
  return true;
}

async function decodeWithNativeDetector(
  img: HTMLImageElement
): Promise<string | null> {
  if (!(await canUseNativeDetector())) return null;

  const Ctor = (globalThis as unknown as { BarcodeDetector: BarcodeDetectorCtor })
    .BarcodeDetector;
  const detector = new Ctor({ formats: [...NATIVE_FORMATS] });
  const canvas = document.createElement("canvas");

  // Full frame first, then center crops for small sticker barcodes.
  const zooms = [1, 1.5, 2, 2.5];
  for (const zoom of zooms) {
    try {
      let codes: DetectedBarcode[];
      let w: number;
      let h: number;

      if (zoom <= 1.01) {
        codes = await detector.detect(img);
        w = img.naturalWidth || img.width || 1;
        h = img.naturalHeight || img.height || 1;
      } else if (drawImageCenterCrop(img, canvas, zoom)) {
        codes = await detector.detect(canvas);
        w = canvas.width || 1;
        h = canvas.height || 1;
      } else {
        continue;
      }

      const code = pickBestDetectedCode(codes, w, h);
      if (code) return code;
    } catch {
      // try next zoom
    }
  }

  return null;
}

async function decodeWithHtml5Qrcode(file: File): Promise<string | null> {
  const host = document.createElement("div");
  host.id = `kcw-html5-file-${Math.random().toString(36).slice(2, 9)}`;
  host.style.display = "none";
  document.body.appendChild(host);

  const scanner = new Html5Qrcode(host.id, {
    formatsToSupport: ZXING_FORMATS,
    verbose: false,
    useBarCodeDetectorIfSupported: false,
  });

  try {
    const decoded = await scanner.scanFile(file, /* showImage= */ false);
    return sanitizeBarcode(decoded);
  } catch {
    return null;
  } finally {
    try {
      scanner.clear();
    } catch {
      // ignore
    }
    host.remove();
  }
}

/**
 * Decode a product barcode from a still image (camera capture or gallery upload).
 * Returns the sanitized code or null when nothing readable is found.
 */
export async function decodeBarcodeFromImageFile(
  file: File
): Promise<string | null> {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("กรุณาเลือกรูปภาพ");
  }

  const img = await loadImageFromBlob(file);
  const native = await decodeWithNativeDetector(img);
  if (native) return native;

  return decodeWithHtml5Qrcode(file);
}
