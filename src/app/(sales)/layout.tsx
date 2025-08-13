import PosProvider from "@/components/pos/PosProvider";

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <PosProvider>{children}</PosProvider>;
}
