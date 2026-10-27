"use client";

import { useEffect, useMemo, useState } from "react";

import type { ToBillRef } from "@/lib/sales/to-bill";
import { isHqTadBillno } from "@/lib/sales/to-bill";

type IndexState = {
  rows: ToBillRef[];
  canCreate: boolean;
  createBaseUrl: string;
  ready: boolean;
};

const empty: IndexState = {
  rows: [],
  canCreate: false,
  createBaseUrl: "",
  ready: false,
};

export function useToBillIndex(billnos: string[]) {
  const unique = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of billnos) {
      const bill = raw.trim().toUpperCase();
      if (!isHqTadBillno(bill) || seen.has(bill)) continue;
      seen.add(bill);
      out.push(bill);
    }
    out.sort();
    return out;
  }, [billnos]);
  const key = unique.join(",");
  const [state, setState] = useState<IndexState>(empty);

  useEffect(() => {
    if (!key) {
      setState({ ...empty, ready: true });
      return;
    }
    let cancelled = false;
    const bills = key.split(",");
    const chunks: string[][] = [];
    for (let index = 0; index < bills.length; index += 150) {
      chunks.push(bills.slice(index, index + 150));
    }
    void Promise.all(
      chunks.map(async (chunk) => {
        const res = await fetch(`/api/to-bills?billnos=${encodeURIComponent(chunk.join(","))}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "โหลดใบเต็มไม่สำเร็จ");
        return json as {
          rows?: ToBillRef[];
          can_create?: boolean;
          create_base_url?: string;
        };
      })
    )
      .then((payloads) => {
        if (cancelled) return;
        setState({
          rows: payloads.flatMap((payload) => payload.rows ?? []),
          canCreate: Boolean(payloads[0]?.can_create),
          createBaseUrl: String(payloads[0]?.create_base_url ?? ""),
          ready: true,
        });
      })
      .catch(() => {
        if (!cancelled) setState({ ...empty, ready: true });
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const byBill = useMemo(() => {
    const map: Record<string, ToBillRef> = {};
    for (const row of state.rows) {
      map[row.tad_billno.trim().toUpperCase()] = row;
    }
    return map;
  }, [state.rows]);

  return { ...state, byBill };
}
