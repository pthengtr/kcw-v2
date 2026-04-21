import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { KbPartListItem } from "../types";

type KbFixedSearchCardProps = {
  fixedQuery: string;
  fixedResults: KbPartListItem[];
};

export function KbFixedSearchCard({
  fixedQuery,
  fixedResults,
}: KbFixedSearchCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>ทดสอบค้นหาแบบคำตรง</CardTitle>
        <CardDescription>
          ค้นหาจาก title / keywords / content / related แบบตรงคำ
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <form className="flex gap-2" method="get">
          <Input
            name="fixed_q"
            defaultValue={fixedQuery}
            placeholder="พิมพ์คำที่ต้องการค้นหา"
          />
          <Button type="submit">ค้นหา</Button>
        </form>

        {fixedQuery ? (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              ผลลัพธ์สำหรับ: <span className="font-medium">{fixedQuery}</span>
            </div>

            {fixedResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">ไม่พบข้อมูล</p>
            ) : (
              fixedResults.map((item) => (
                <Link
                  key={item.id}
                  href={`/kb?id=${item.id}&fixed_q=${encodeURIComponent(fixedQuery)}`}
                  className="block rounded-lg border p-3 text-sm hover:bg-muted/30"
                >
                  <div className="font-medium">
                    #{item.id} {item.title || "(ไม่มีชื่อ)"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {item.keywords || "-"}
                  </div>
                </Link>
              ))
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            พิมพ์คำเพื่อทดสอบการค้นหาแบบตรงคำ
          </p>
        )}
      </CardContent>
    </Card>
  );
}
