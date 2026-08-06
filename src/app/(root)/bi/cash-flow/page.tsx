import CashFlowOverviewPage from "@/components/bi/cashflow/CashFlowOverviewPage";
import { requirePermission } from "@/lib/auth/requirePermission";
import { BI_PAGE_KEYS } from "@/lib/auth/rbac-pages";

export default async function BiCashFlowPage() {
  const permCheck = await requirePermission(BI_PAGE_KEYS.cashflow);
  if (!permCheck.ok) {
    return (
      <div className="px-4 py-8 text-muted-foreground">
        คุณไม่มีสิทธิ์เข้าถึงหน้านี้
      </div>
    );
  }

  return <CashFlowOverviewPage />;
}
