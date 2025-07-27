import SupplierProvider from "@/components/supplier/SupplierProvider";

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <SupplierProvider>{children}</SupplierProvider>;
}
