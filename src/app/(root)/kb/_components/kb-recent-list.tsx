import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { KbPartListItem } from "../types";

type KbRecentListProps = {
  recentItems: KbPartListItem[];
  selectedId: number | null;
  isNewMode: boolean;
};

export function KbRecentList({
  recentItems,
  selectedId,
  isNewMode,
}: KbRecentListProps) {
  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>รายการ FAQ ล่าสุด</CardTitle>
        <CardDescription>
          อ่านข้อมูลจาก <code>kb.kb_parts</code>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/kb?mode=new">สร้าง FAQ ใหม่</Link>
          </Button>
        </div>

        {recentItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูล FAQ</p>
        ) : (
          recentItems.map((item) => {
            const active = !isNewMode && selectedId === item.id;

            return (
              <Link
                key={item.id}
                href={`/kb?id=${item.id}`}
                className={`block rounded-lg border p-3 text-sm transition ${
                  active ? "border-primary bg-muted/40" : "hover:bg-muted/30"
                }`}
              >
                <div className="font-medium">
                  #{item.id} {item.title || "(ไม่มีชื่อ)"}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {item.keywords || "-"}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  อัปเดตล่าสุด: {new Date(item.updated_at).toLocaleString()}
                </div>
              </Link>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
