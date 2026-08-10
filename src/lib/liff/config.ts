/**
 * Browser-safe LIFF config only.
 * Never put LINE channel secret / access token / Supabase service keys here.
 */

export function getProductScannerLiffId(): string {
  return (process.env.NEXT_PUBLIC_LINE_LIFF_PRODUCT_SCANNER_ID || "").trim();
}

export function hasProductScannerLiffId(): boolean {
  return getProductScannerLiffId().length > 0;
}
