/**
 * Deterministic LINE text contract for product-scan LIFF → kcw-api.
 * Must stay in sync with kcw-api `src/liff/product_scan_contract.py`.
 */

export const PRODUCT_SCAN_CALLBACK_PREFIX = "📦 สแกนสินค้า:";

const BARCODE_RE = /^[A-Za-z0-9\-_.]{1,64}$/;

export function sanitizeBarcode(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const code = String(raw).trim();
  if (!code || !BARCODE_RE.test(code)) return null;
  return code;
}

export function formatProductScanCallback(barcode: string): string {
  const code = sanitizeBarcode(barcode);
  if (!code) {
    throw new Error("Invalid barcode for product scan callback");
  }
  return `${PRODUCT_SCAN_CALLBACK_PREFIX} ${code}`;
}

export function parseProductScanCallback(text: string | null | undefined): string | null {
  const t = (text || "").trim();
  const prefixes = [PRODUCT_SCAN_CALLBACK_PREFIX, "สแกนสินค้า:"];
  for (const prefix of prefixes) {
    if (t.startsWith(prefix)) {
      return sanitizeBarcode(t.slice(prefix.length));
    }
  }
  return null;
}
