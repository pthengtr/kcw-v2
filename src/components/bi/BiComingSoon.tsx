import { Construction } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export default function BiComingSoon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="border-dashed border-slate-300 bg-white/80 shadow-none">
      <CardContent className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <Construction className="h-10 w-10 text-slate-400" aria-hidden />
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        <p className="text-xs text-muted-foreground">
          โครงสร้างเมนูพร้อมแล้ว — จะต่อข้อมูลจาก curated_kcw ในรอบถัดไป
        </p>
      </CardContent>
    </Card>
  );
}
