import VatRegisterPage from "@/components/vat/VatRegisterPage";
import { requirePermission } from "@/lib/auth/requirePermission";
import { BI_PAGE_KEYS } from "@/lib/auth/rbac-pages";

export default async function BiVatRegisterPage() {
  const permCheck = await requirePermission(BI_PAGE_KEYS.vatRegister);
  if (!permCheck.ok) {
    return (
      <div className="p-6 text-sm text-muted-foreground">{permCheck.message}</div>
    );
  }
  return <VatRegisterPage />;
}
