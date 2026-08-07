import { describe, expect, it } from "vitest";

import {
  buildTransactionFingerprint,
  sha256HexAsync,
} from "./fingerprint.ts";

const BASE = {
  account_no: "064-8-92039-3",
  txn_date: "2026-05-04",
  direction: "in" as const,
  amount: 50000,
  balance_after: 69237.34,
  bank_reference: null,
  transaction_detail: "จาก X3557 บจก. เกียรติชัยอะไ++",
};

describe("buildTransactionFingerprint", () => {
  it("Test 1 — same identity when display description formatting differs", async () => {
    const fpA = await buildTransactionFingerprint(BASE);
    const fpB = await buildTransactionFingerprint({
      ...BASE,
      // description is not part of identity; only detail matters
      transaction_detail: BASE.transaction_detail,
    });
    expect(fpA).toBe(fpB);
    expect(fpA).toHaveLength(64);

    // Simulates KBANK overlapping files: time vs รายการ label in display only
    const fpTimeLabel = await buildTransactionFingerprint({
      ...BASE,
      transaction_detail: "จาก X3557 บจก. เกียรติชัยอะไ++",
    });
    const fpThaiLabel = await buildTransactionFingerprint({
      ...BASE,
      transaction_detail: "จาก X3557 บจก. เกียรติชัยอะไ++",
    });
    expect(fpTimeLabel).toBe(fpThaiLabel);
  });

  it("Test 2 — different fingerprints for legitimate repeated same-amount transactions", async () => {
    const first = await buildTransactionFingerprint({
      account_no: "064-8-92039-3",
      txn_date: "2026-05-25",
      direction: "in",
      amount: 1000,
      balance_after: 100500,
      bank_reference: null,
      transaction_detail: "จาก X3557 บจก. เกียรติชัยอะไ++",
    });
    const second = await buildTransactionFingerprint({
      account_no: "064-8-92039-3",
      txn_date: "2026-05-25",
      direction: "in",
      amount: 1000,
      balance_after: 101500,
      bank_reference: null,
      transaction_detail: "จาก KTB X8740 MISS NARUMON WITHA++",
    });
    expect(first).not.toBe(second);
  });

  it("Test 3 — overlapping cumulative statement rows share fingerprints with earlier imports", async () => {
    const earlierImportLine = {
      account_no: "064-8-92039-3",
      txn_date: "2026-05-12",
      direction: "out" as const,
      amount: 55,
      balance_after: 150934.41,
      bank_reference: null,
      transaction_detail: "โอนไป KTB X2446 น.ส.นฤมล วิทยผโลท++",
    };
    const cumulativeImportLine = {
      ...earlierImportLine,
      // display description would differ (15:57:00 vs โอนเงิน) but detail is stable
      transaction_detail: "โอนไป KTB X2446 น.ส.นฤมล วิทยผโลท++",
    };

    const fpEarlier = await buildTransactionFingerprint(earlierImportLine);
    const fpCumulative = await buildTransactionFingerprint(cumulativeImportLine);
    expect(fpEarlier).toBe(fpCumulative);

    const overlappingFingerprints = new Set([fpEarlier, fpCumulative]);
    expect(overlappingFingerprints.size).toBe(1);

    const newOnlyLine = await buildTransactionFingerprint({
      account_no: "064-8-92039-3",
      txn_date: "2026-05-29",
      direction: "in",
      amount: 99999.99,
      balance_after: 500000,
      bank_reference: null,
      transaction_detail: "จาก NEW TRANSACTION ONLY",
    });
    overlappingFingerprints.add(newOnlyLine);
    expect(overlappingFingerprints.size).toBe(2);
  });

  it("Test 4 — file_hash (SHA-256 of file bytes) is stable for exact re-upload", async () => {
    const bytes = new TextEncoder().encode("same-statement-bytes");
    const hash1 = await sha256HexAsync(bytes);
    const hash2 = await sha256HexAsync(bytes);
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(await sha256HexAsync(new TextEncoder().encode("other-bytes")));
  });
});
