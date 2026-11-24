import ExpenseCashRequestsPage from "@/components/expense/cash-requests/ExpenseCashRequestsPage";
import { ROLE_ADMIN } from "@/lib/auth/rbac-pages";
import { getMyPageAccess } from "@/lib/auth/page-access";

export default async function Page() {
  const { roleKeys } = await getMyPageAccess();
  const canManage = roleKeys.includes(ROLE_ADMIN);
  return <ExpenseCashRequestsPage canManage={canManage} />;
}
