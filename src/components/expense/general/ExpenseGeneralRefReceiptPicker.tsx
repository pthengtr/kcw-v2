"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ExpenseReceiptType } from "@/lib/types/models";

type Props = {
  value?: ExpenseReceiptType | null;
  onChange: (receipt: ExpenseReceiptType | undefined) => void;
  error?: string;
};

export default function ExpenseGeneralRefReceiptPicker({
  value,
  onChange,
  error = "",
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [filterText, setFilterText] = useState("");
  const [options, setOptions] = useState<ExpenseReceiptType[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<number | null>(null);

  const runQuery = useCallback(
    async (text: string) => {
      if (!text || text.trim().length < 1) {
        setOptions([]);
        return;
      }
      setLoading(true);
      const { data, error: queryError } = await supabase
        .from("expense_receipt")
        .select("*, party (*), payment_method (*), branch (*)")
        .eq("doc_type", "RECEIPT")
        .ilike("receipt_number", `%${text}%`)
        .order("receipt_date", { ascending: false })
        .limit(50);

      if (queryError) {
        console.error("ExpenseGeneralRefReceiptPicker", queryError.message);
        setOptions([]);
      } else {
        setOptions((data ?? []) as ExpenseReceiptType[]);
      }
      setLoading(false);
    },
    [supabase]
  );

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(
      () => void runQuery(filterText),
      250
    );
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [filterText, runQuery]);

  const selected = value ?? undefined;

  return (
    <div className="flex flex-col gap-2">
      {selected ? (
        <div className="rounded-md border bg-background px-3 py-2 text-sm">
          <div className="font-semibold">{selected.receipt_number}</div>
          <div className="text-xs text-muted-foreground">
            {formatDate(selected.receipt_date)} • ฿
            {fmtMoney(selected.total_amount)}
            {selected.vat ? ` • VAT ${selected.vat}%` : ""}
            {selected.party?.party_name ? ` • ${selected.party.party_name}` : ""}
          </div>
          <button
            type="button"
            className="mt-1 text-xs text-muted-foreground underline"
            onClick={() => {
              onChange(undefined);
              setFilterText("");
              setOptions([]);
            }}
          >
            เปลี่ยนบิลอ้างอิง
          </button>
        </div>
      ) : (
        <>
          <Input
            autoFocus
            placeholder="พิมพ์เลขที่บิลบริษัท..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
          <div className="max-h-48 overflow-y-auto rounded-md border bg-background">
            {loading ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                กำลังค้นหา...
              </div>
            ) : null}
            {!loading && filterText && options.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                ไม่พบเอกสารที่ตรงกัน
              </div>
            ) : null}
            {!filterText ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                ค้นหาจากเลขที่เอกสาร
              </div>
            ) : null}
            {options.map((rec) => (
              <Button
                key={rec.receipt_uuid}
                type="button"
                variant="ghost"
                className="h-auto w-full justify-start rounded-none px-3 py-2 text-left"
                onClick={() => onChange(rec)}
              >
                <div className="flex flex-col items-start">
                  <div className="font-semibold leading-tight">
                    {rec.receipt_number}
                  </div>
                  <div className="text-xs opacity-70">
                    {formatDate(rec.receipt_date)} • ฿
                    {fmtMoney(rec.total_amount)}
                    {rec.vat ? ` • VAT ${rec.vat}%` : ""}
                    {rec.party?.party_name ? ` • ${rec.party.party_name}` : ""}
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </>
      )}
      {error ? <div className="text-red-500 text-xs">{error}</div> : null}
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function fmtMoney(n: number) {
  return n.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
