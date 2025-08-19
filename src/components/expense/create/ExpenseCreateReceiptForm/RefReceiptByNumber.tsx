import {
  ChangeEvent,
  useCallback,
  useContext,
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
import { useParams } from "next/navigation";
import { ExpenseContext, ExpenseContextType } from "../../ExpenseProvider";
import { ExpenseReceiptType } from "@/lib/types/models";

type Props = {
  error?: string;
  placeholder?: string;
  buttonLabel?: string;
};

export default function RefReceiptByNumber({
  error = "",
  placeholder = "พิมพ์เลขที่เอกสาร (เช่น INV-2025-0012)...",
  buttonLabel = "เลือกเลขที่ใบเสร็จอ้างอิง",
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [filterText, setFilterText] = useState("");
  const [options, setOptions] = useState<ExpenseReceiptType[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<number | null>(null);

  const { branch: branch_uuid } = useParams();

  const { selectedRefReceipt, setSelectedRefReceipt, setSelectedSupplier } =
    useContext(ExpenseContext) as ExpenseContextType;

  function onChange(rec: ExpenseReceiptType) {
    setSelectedRefReceipt(rec);
    setSelectedSupplier(rec.party);
  }

  const runQuery = useCallback(
    async (text: string) => {
      if (!text || text.trim().length < 1) {
        setOptions([]);
        return;
      }
      setLoading(true);

      const query = supabase
        .from("expense_receipt")
        .select(`*, supplier (*)`)
        .eq("doc_type", "RECEIPT")
        .eq("branch_uuid", branch_uuid)
        .ilike("receipt_number", `%${text}%`)
        .order("receipt_date", { ascending: false })
        .limit(50);

      const { data, error } = await query;
      if (error) {
        console.error("RefReceiptByNumber query error:", error.message);
        setOptions([]);
      } else {
        setOptions((data ?? []) as ExpenseReceiptType[]);
      }
      setLoading(false);
    },
    [supabase, branch_uuid] // ✅ dependencies
  );

  // fetch when typing
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
  }, [filterText, open, branch_uuid, runQuery]);

  function handlePick(rec: ExpenseReceiptType) {
    onChange(rec);
    setOpen(false);
  }

  function handleFilterChange(e: ChangeEvent<HTMLInputElement>) {
    setFilterText(e.target.value);
  }

  const selected = selectedRefReceipt;

  return (
    <div className="flex flex-col gap-1">
      <DropdownMenu
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (v) void runQuery(filterText);
        }}
      >
        <DropdownMenuTrigger
          asChild
          className="max-w-96 truncate flex justify-start"
        >
          <Button variant="outline" className="justify-start">
            {selected ? (
              <div className="flex flex-col items-start">
                <div className="font-semibold">{selected.receipt_number}</div>
                <div className="text-xs opacity-70">
                  {formatDate(selected.receipt_date)} • ฿
                  {fmtMoney(selected.total_amount)} •{" "}
                  {selected.party?.party_code ?? ""}{" "}
                  {selected.party?.party_name
                    ? `— ${selected.party.party_name}`
                    : ""}
                </div>
              </div>
            ) : (
              buttonLabel
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-[28rem]">
          <DropdownMenuLabel>
            <div className="p-2">
              <Input
                autoFocus
                placeholder={placeholder}
                value={filterText}
                onChange={handleFilterChange}
                className="h-8"
              />
              <div className="mt-1 text-[10px] text-muted-foreground">
                ค้นหาจากเลขที่เอกสาร • กรองตามสาขา
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
              onClick={() => handlePick(rec)}
              className="flex flex-col items-start gap-0.5"
            >
              <div className="font-semibold leading-tight">
                {highlight(rec.receipt_number, filterText)}
              </div>
              <div className="text-xs opacity-70">
                {formatDate(rec.receipt_date)} • ฿{fmtMoney(rec.total_amount)} •{" "}
                {rec.party?.party_code ?? ""}
                {rec.party?.party_name ? ` — ${rec.party.party_name}` : ""}
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {error && <div className="text-red-500 text-xs">{error}</div>}
    </div>
  );
}

/* Helpers */
function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
function fmtMoney(n: number) {
  try {
    return n.toLocaleString("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return String(n);
  }
}
function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function highlight(text: string, needle: string) {
  if (!needle) return text;
  const parts = text.split(new RegExp(`(${escapeRegex(needle)})`, "gi"));
  return (
    <span>
      {parts.map((p, i) =>
        p.toLowerCase() === needle.toLowerCase() ? (
          <mark key={i} className="px-0.5 rounded">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </span>
  );
}
