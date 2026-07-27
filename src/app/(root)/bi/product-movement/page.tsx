import ProductMovementPage from "@/components/bi/products/ProductMovementPage";
import { requirePermission } from "@/lib/auth/requirePermission";
import { BI_PAGE_KEYS } from "@/lib/auth/rbac-pages";

export default async function BiProductMovementPage() {
  const permCheck = await requirePermission(BI_PAGE_KEYS.productMovement);
  if (!permCheck.ok) {
    return (
      <div className="px-4 py-8 text-muted-foreground">
        คุณไม่มีสิทธิ์เข้าถึงหน้านี้
      </div>
    );
  }

  return <ProductMovementPage />;
}
