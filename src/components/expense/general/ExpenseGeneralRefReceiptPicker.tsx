"use client";

import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const [open, setOpen] = useState(false);
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
    if (!open) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(
      () => void runQuery(filterText),
      250
    );
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [filterText, open, runQuery]);

  const selected = value ?? undefined;

  return (
    <div className="flex flex-col gap-1">
      <DropdownMenu
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (v) void runQuery(filterText);
        }}
      >
        <DropdownMenuTrigger asChild className="max-w-full truncate flex justify-start">
          <Button variant="outline" className="h-auto min-h-10 w-full justify-start">
            {selected ? (
              <div className="flex flex-col items-start text-left">
                <div className="font-semibold">{selected.receipt_number}</div>
                <div className="text-xs opacity-70">
                  {formatDate(selected.receipt_date)} • ฿
                  {fmtMoney(selected.total_amount)}
                  {selected.vat ? ` • VAT ${selected.vat}%` : ""}
                  {selected.party?.party_name
                    ? ` • ${selected.party.party_name}`
                    : ""}
                </div>
              </div>
            ) : (
              "เลือกบิลบริษัทที่ต้องการหัก"
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[min(28rem,calc(100vw-2rem))]">
          <DropdownMenuLabel>
            <div className="p-2">
              <Input
                autoFocus
                placeholder="พิมพ์เลขที่บิลบริษัท..."
                value={filterText}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setFilterText(e.target.value)
                }
                className="h-8"
              />
              <div className="mt-1 text-[10px] text-muted-foreground">
                ค้นหาจากเลขที่เอกสาร
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {loading && (
            <DropdownMenuItem disabled>กำลังค้นหา...</DropdownMenuItem>
          )}
          {!loading && options.length === 0 && filterText && (
            <DropdownMenuItem disabled>ไม่พบเอกสารที่ตรงกัน</DropdownMenuItem>
          )}
          {options.map((rec) => (
            <DropdownMenuItem
              key={rec.receipt_uuid}
              onClick={() => {
                onChange(rec);
                setOpen(false);
              }}
              className="flex flex-col items-start gap-0.5"
            >
              <div className="font-semibold leading-tight">
                {rec.receipt_number}
              </div>
              <div className="text-xs opacity-70">
                {formatDate(rec.receipt_date)} • ฿{fmtMoney(rec.total_amount)}
                {rec.vat ? ` • VAT ${rec.vat}%` : ""}
                {rec.party?.party_name ? ` • ${rec.party.party_name}` : ""}
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {selected ? (
        <button
          type="button"
          className="self-start text-xs text-muted-foreground underline"
          onClick={() => onChange(undefined)}
        >
          ล้างบิลอ้างอิง
        </button>
      ) : null}
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
