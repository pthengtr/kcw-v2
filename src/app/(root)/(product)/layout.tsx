import ProductProvider from "@/components/product/ProductProvider";

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <ProductProvider>{children}</ProductProvider>
    </>
  );
}
