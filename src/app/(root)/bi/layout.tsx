import BiShell from "@/components/bi/BiShell";

export default function BiLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <BiShell>{children}</BiShell>;
}
