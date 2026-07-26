import { Sparkles } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type BiHighlightsCardProps = {
  lines: string[];
  title?: string;
};

export default function BiHighlightsCard({
  lines,
  title = "สรุปช่วงนี้",
}: BiHighlightsCardProps) {
  if (lines.length === 0) return null;

  return (
    <Card className="border-teal-200/70 bg-gradient-to-br from-teal-50/80 via-white to-slate-50 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <Sparkles className="h-4 w-4 text-teal-700" aria-hidden />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm leading-relaxed text-slate-700">
          {lines.map((line) => (
            <li key={line} className="flex gap-2">
              <span
                className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600"
                aria-hidden
              />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
