import ReminderProvider from "@/components/reminder/ReminderProvider";

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <ReminderProvider>{children}</ReminderProvider>
    </>
  );
}
