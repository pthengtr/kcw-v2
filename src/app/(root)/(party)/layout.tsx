import { PartyProvider } from "@/components/party/PartyProvider";

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <PartyProvider>{children}</PartyProvider>
    </>
  );
}
