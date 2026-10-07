import { Suspense } from "react";

import OnlineStatementsPage from "@/components/online-statements/OnlineStatementsPage";
import { requirePermission } from "@/lib/auth/requirePermission";
import { ONLINE_STATEMENT_READ_PAGE_KEYS } from "@/lib/auth/rbac-pages";

export default async function Page() {
  const permCheck = await requirePermission(ONLINE_STATEMENT_READ_PAGE_KEYS);
  if (!permCheck.ok) {
    return (
      <div className="px-4 py-8 text-muted-foreground">
        คุณไม่มีสิทธิ์เข้าถึงหน้านี้
      </div>
    );
  }

  return (
    <Suspense>
      <OnlineStatementsPage readOnly />
    </Suspense>
  );
}
