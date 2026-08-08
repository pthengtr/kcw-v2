import IncomeStatementOverviewPage from "@/components/bi/income-statement/IncomeStatementOverviewPage";
import { requirePermission } from "@/lib/auth/requirePermission";
import { BI_PAGE_KEYS } from "@/lib/auth/rbac-pages";

export default async function BiIncomeStatementPage() {
  const permCheck = await requirePermission(BI_PAGE_KEYS.incomeStatement);
  if (!permCheck.ok) {
    return (
      <div className="p-6 text-sm text-muted-foreground">{permCheck.message}</div>
    );
  }
  return <IncomeStatementOverviewPage />;
}
