import { requirePermission } from "@/lib/auth/requirePermission";
import { ADMIN_RBAC_PAGE } from "@/lib/auth/rbac-pages";
import RbacAdminPage from "@/components/rbac/RbacAdminPage";

export default async function AdminRbacPage() {
  const permCheck = await requirePermission(ADMIN_RBAC_PAGE);
  if (!permCheck.ok) {
    return (
      <div className="px-4 py-8 text-muted-foreground">
        คุณไม่มีสิทธิ์เข้าถึงหน้านี้
      </div>
    );
  }

  return <RbacAdminPage />;
}

