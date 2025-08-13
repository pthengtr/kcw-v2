import PurchaseProvider from "@/components/purchase/PurchaseProvider";

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <PurchaseProvider>{children}</PurchaseProvider>;
}
