import ExpenseProvider from "@/components/expense/ExpenseProvider";

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <ExpenseProvider>{children}</ExpenseProvider>;
}
