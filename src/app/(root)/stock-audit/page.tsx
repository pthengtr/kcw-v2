import StockAuditPage from "@/components/stock-audit/StockAuditPage";
import { requirePermission } from "@/lib/auth/requirePermission";
import { STOCK_AUDIT_PAGE_KEY } from "@/lib/auth/rbac-pages";

export default async function StockAuditRoutePage() {
  const permCheck = await requirePermission(STOCK_AUDIT_PAGE_KEY);
  if (!permCheck.ok) {
    return (
      <main className="grid min-h-[40vh] place-content-center p-8">
        <p className="text-center text-muted-foreground">
          คุณไม่มีสิทธิ์เข้าถึงหน้านี้
        </p>
      </main>
    );
  }

  return <StockAuditPage />;
}
