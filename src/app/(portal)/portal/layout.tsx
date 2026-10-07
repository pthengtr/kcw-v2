import PortalHeader from "@/components/portal/PortalHeader";

export default function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-slate-50">
      <PortalHeader />
      {children}
    </div>
  );
}
