import { PartyProvider } from "@/components/party/PartyProvider";
import ReminderProvider from "@/components/reminder/ReminderProvider";

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <PartyProvider>
        <ReminderProvider>{children}</ReminderProvider>
      </PartyProvider>
    </>
  );
}
