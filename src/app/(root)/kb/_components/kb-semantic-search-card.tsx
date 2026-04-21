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
import type { KbSemanticSearchResult } from "../types";

type KbSemanticSearchCardProps = {
  semanticQuery: string;
  semanticResults: KbSemanticSearchResult[];
};

export function KbSemanticSearchCard({
  semanticQuery,
  semanticResults,
}: KbSemanticSearchCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>ทดสอบค้นหาแบบความหมาย</CardTitle>
        <CardDescription>
          แปลงคำค้นเป็น embedding แล้วเทียบกับ{" "}
          <code>kb.kb_parts.embedding</code>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <form className="flex gap-2" method="get">
          <Input
            name="semantic_q"
            defaultValue={semanticQuery}
            placeholder="พิมพ์คำค้นแบบภาษาธรรมชาติ"
          />
          <Button type="submit">ค้นหา</Button>
        </form>

        {semanticQuery ? (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              ผลลัพธ์สำหรับ:{" "}
              <span className="font-medium">{semanticQuery}</span>
            </div>

            {semanticResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                ไม่พบข้อมูลที่ใกล้เคียง
              </p>
            ) : (
              semanticResults.map((item) => (
                <Link
                  key={item.id}
                  href={`/kb?id=${item.id}&semantic_q=${encodeURIComponent(semanticQuery)}`}
                  className="block rounded-lg border p-3 text-sm hover:bg-muted/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-medium">
                      #{item.id} {item.title || "(ไม่มีชื่อ)"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.similarity.toFixed(4)}
                    </div>
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
            พิมพ์ประโยคหรือคำถามเพื่อทดสอบการค้นหาแบบความหมาย
          </p>
        )}
      </CardContent>
    </Card>
  );
}
