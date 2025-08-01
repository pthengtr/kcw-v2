import type { Metadata } from "next";
import { Prompt } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import GlobalLoading from "@/components/common/GlobalLoading";

const prompt = Prompt({
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "KCW V2",
  description: "",
};

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${prompt.className} antialiased h-full`}>
        <GlobalLoading />
        {children}
        <Toaster richColors expand={true} />
      </body>
    </html>
  );
}
