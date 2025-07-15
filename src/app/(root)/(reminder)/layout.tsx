import ReminderProvider from "@/components/reminder/ReminderProvider";

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <h1>test provider</h1>
      <ReminderProvider>{children}</ReminderProvider>
    </>
  );
}
