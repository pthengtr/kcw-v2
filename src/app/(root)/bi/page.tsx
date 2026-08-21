import { redirect } from "next/navigation";

import { getMyPageAccess } from "@/lib/auth/page-access";
import { firstAllowedBiReport } from "@/lib/bi/reports";

export default async function BiIndexPage() {
  const { pageKeys } = await getMyPageAccess();
  const first = firstAllowedBiReport(pageKeys);
  if (!first) {
    return (
      <div className="px-4 py-8 text-muted-foreground">
        คุณไม่มีสิทธิ์เข้าถึงหน้านี้
      </div>
    );
  }
  redirect(first.href);
}
