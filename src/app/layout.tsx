import type { Metadata, Viewport } from "next";
import { Prompt } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import GlobalLoadingUI from "@/components/common/GlobalLoading";

const prompt = Prompt({
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "KCW V2",
  description: "ระบบงานภายใน KCW",
  applicationName: "KCW V2",
  appleWebApp: {
    capable: true,
    title: "KCW",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2563eb",
};

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${prompt.className} antialiased h-full`}>
        <GlobalLoadingUI />
        {children}
        <Toaster richColors expand={true} />
      </body>
    </html>
  );
}
