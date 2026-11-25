import ExpenseCashRequestsPage from "@/components/expense/cash-requests/ExpenseCashRequestsPage";
import { ROLE_ADMIN } from "@/lib/auth/rbac-pages";
import { getMyPageAccess } from "@/lib/auth/page-access";

export default async function Page() {
  const { roleKeys } = await getMyPageAccess();
  const canManage = roleKeys.includes(ROLE_ADMIN);
  // Any staff with page access may mark accounting status; approve/reject stays admin.
  return (
    <ExpenseCashRequestsPage
      canManage={canManage}
      canUpdateAccounting
    />
  );
}
