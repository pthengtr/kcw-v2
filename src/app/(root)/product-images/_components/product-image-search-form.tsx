"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import { Loader2, PackageSearch } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

type ProductImageSearchFormProps = {
  bcode: string;
};

export function ProductImageSearchForm({ bcode }: ProductImageSearchFormProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [value, setValue] = useState(bcode);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setValue(bcode);
  }, [bcode]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const clean = value.trim();

    if (!clean) {
      setError("กรุณาระบุรหัสสินค้า");
      return;
    }

    setError("");

    startTransition(() => {
      router.push(`${pathname}?bcode=${encodeURIComponent(clean)}`);
    });
  }

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="text-sm font-medium text-slate-700">
          ค้นหารหัสสินค้า / BCODE
        </label>

        <input
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError("");
          }}
          placeholder="เช่น 01010019"
          className="w-full rounded-xl border px-4 py-3 text-lg outline-none ring-slate-900/10 focus:ring-4"
          autoComplete="off"
          inputMode="numeric"
        />

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              กำลังค้นหา...
            </>
          ) : (
            <>
              <PackageSearch className="h-4 w-4" />
              ค้นหา
            </>
          )}
        </button>
      </form>
    </div>
  );
}
