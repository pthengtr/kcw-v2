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
        <CardTitle>Fixed-term search tester</CardTitle>
        <CardDescription>
          Deterministic text search against title / keywords / content /
          related.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <form className="flex gap-2" method="get">
          <Input
            name="fixed_q"
            defaultValue={fixedQuery}
            placeholder="search exact/fixed term"
          />
          <Button type="submit">Search</Button>
        </form>

        {fixedQuery ? (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Results for: <span className="font-medium">{fixedQuery}</span>
            </div>

            {fixedResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">No match found.</p>
            ) : (
              fixedResults.map((item) => (
                <Link
                  key={item.id}
                  href={`/kb?id=${item.id}&fixed_q=${encodeURIComponent(fixedQuery)}`}
                  className="block rounded-lg border p-3 text-sm hover:bg-muted/30"
                >
                  <div className="font-medium">
                    #{item.id} {item.title || "(untitled)"}
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
            Enter a term to test deterministic retrieval.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
