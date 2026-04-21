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
        <CardTitle>Semantic search tester</CardTitle>
        <CardDescription>
          Embeds the query, runs vector match on{" "}
          <code>kb.kb_parts.embedding</code>, and shows the nearest rows.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <form className="flex gap-2" method="get">
          <Input
            name="semantic_q"
            defaultValue={semanticQuery}
            placeholder="test semantic query"
          />
          <Button type="submit">Search</Button>
        </form>

        {semanticQuery ? (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Results for: <span className="font-medium">{semanticQuery}</span>
            </div>

            {semanticResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No semantic match found.
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
                      #{item.id} {item.title || "(untitled)"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {(item.similarity ?? 0).toFixed(4)}
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
            Enter a natural-language query to test vector retrieval.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
