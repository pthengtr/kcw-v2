import VatRegisterPage from "@/components/vat/VatRegisterPage";
import { requirePermission } from "@/lib/auth/requirePermission";
import { VAT_REGISTER_PAGE_KEY } from "@/lib/auth/rbac-pages";

export default async function VatRegisterRoute() {
  const permCheck = await requirePermission(VAT_REGISTER_PAGE_KEY);
  if (!permCheck.ok) {
    return (
      <div className="p-6 text-sm text-muted-foreground">{permCheck.message}</div>
    );
  }
  return <VatRegisterPage />;
}
