import type { Metadata, Viewport } from "next";

import ScanProductScreen from "./_components/scan-product-screen";

export const metadata: Metadata = {
  title: "สแกนสินค้า | KCW",
  description: "LIFF product barcode scanner for LINE chatbot",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#09090b",
};

export default function ScanProductPage() {
  return <ScanProductScreen />;
}
