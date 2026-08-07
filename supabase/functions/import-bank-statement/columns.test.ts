import { describe, expect, it } from "vitest";

import {
  columnsAreUsable,
  resolveStatementColumns,
} from "./columns.ts";
import {
  buildTransactionFingerprint,
  normalizeStableTransactionDetail,
} from "./fingerprint.ts";

describe("resolveStatementColumns", () => {
  it("resolves KTB DownLoadService English headers via signed Amount", () => {
    const resolved = resolveStatementColumns([
      "Date",
      "Teller Id",
      "Transaction Code",
      "Description",
      "Cheque No.",
      "Amount",
      "Tax",
      "Balance",
      "Init Br",
    ]);
    expect(resolved.colDate).toBe("DATE");
    expect(resolved.colAmount).toBe("AMOUNT");
    expect(resolved.colDebit).toBeNull();
    expect(resolved.colCredit).toBeNull();
    expect(resolved.colTxnDetail).toBe("DESCRIPTION");
    expect(resolved.colBalance).toBe("BALANCE");
    expect(columnsAreUsable(resolved)).toBe(true);
  });

  it("resolves KTB Thai Corporate Online signed ถอนเงิน/ฝากเงิน without dual debit/credit", () => {
    const resolved = resolveStatementColumns([
      "วันที่/ เวลา",
      "รายการ",
      "รายละเอียด",
      "หมายเลขเช็ค",
      "ถอนเงิน/ฝากเงิน",
      "ภาษี",
      "ยอดคงเหลือ",
      "ช่องทาง",
    ]);
    expect(resolved.colDate).toBe("วันที่/ เวลา");
    expect(resolved.colDesc).toBe("รายการ");
    expect(resolved.colTxnDetail).toBe("รายละเอียด");
    expect(resolved.colAmount).toBe("ถอนเงิน/ฝากเงิน");
    expect(resolved.colDebit).toBeNull();
    expect(resolved.colCredit).toBeNull();
    expect(resolved.colRef).toBe("หมายเลขเช็ค");
    expect(resolved.colBalance).toBe("ยอดคงเหลือ");
    expect(columnsAreUsable(resolved)).toBe(true);
  });
});

describe("normalizeStableTransactionDetail", () => {
  it("strips trailing KTB online transfer ids", () => {
    expect(
      normalizeStableTransactionDetail(
        "TR to 2486006184 KIATCHAI AUTO PART 2007 20260505004000000014",
      ),
    ).toBe("TR to 2486006184 KIATCHAI AUTO PART 2007");
  });

  it("normalizes Future Amount / Tran noise across old and new KTB exports", () => {
    const oldForm = normalizeStableTransactionDetail(
      "004-1521670041 Future Amount: 28694.4  T",
    );
    const newForm = normalizeStableTransactionDetail(
      "004-1521670041~ Future Amount: 28694.4 ~ Tran: IORSDT",
    );
    expect(oldForm).toBe("004-1521670041 Future Amount: 28694.4");
    expect(newForm).toBe(oldForm);
  });
});

describe("buildTransactionFingerprint KTB cross-format", () => {
  it("matches old DownLoadService detail with new Thai Corporate Online detail", async () => {
    const base = {
      account_no: "248-0-42113-9",
      txn_date: "2026-05-05",
      direction: "out" as const,
      amount: 93000,
      balance_after: 8.6,
      bank_reference: null,
    };
    const fpOld = await buildTransactionFingerprint({
      ...base,
      transaction_detail: "TR to 2486006184 KIATCHAI AUTO PART 2007",
    });
    const fpNew = await buildTransactionFingerprint({
      ...base,
      transaction_detail:
        "TR to 2486006184 KIATCHAI AUTO PART 2007 20260505004000000014",
    });
    expect(fpOld).toBe(fpNew);
  });
});
