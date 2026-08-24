import { describe, expect, it } from "vitest";

import { parseStatementSheets } from "./parse-sheets.ts";

const KTB_HEADER = [
  "Date",
  "Teller Id",
  "Transaction Code",
  "Description",
  "Cheque No.",
  "Amount",
  "Tax",
  "Balance",
  "Init Br.",
];

function ktbSheet(accountNo: string, rows: unknown[][]) {
  return {
    name: accountNo,
    grid: [
      [],
      [],
      [],
      [],
      ["Account No.", accountNo],
      ["Account Name", "บจ. เกียรติชัยอะไหล่ยนต์ 2007"],
      KTB_HEADER,
      ...rows,
    ],
  };
}

describe("parseStatementSheets multi-tab", () => {
  it("imports both KTB account tabs with per-sheet account numbers", async () => {
    const { meta, lines } = await parseStatementSheets(
      [
        ktbSheet("248-0-42113-9", [
          ["04/08/2026 03:07:10", "ITBANK", "DDSDT", "TR from Shopee", "", 10554, 0, 10962.59, "1193"],
        ]),
        ktbSheet("248-6-00618-4", [
          ["02/08/2026 19:25:03", "ITBANK", "PBDWT", "TR to vendor", "", -3000, 0, 486687.48, "0248"],
          ["21/08/2026 12:28:27", "ITBANK", "PBDWP", "Provincial Electric", "", -9863.55, 0, 738974.9, "0248"],
        ]),
      ],
      { filename: "6184-1139 W1-23 D8.xls", bankName: "KTB" },
    );

    expect(meta.account_nos).toEqual(["248-0-42113-9", "248-6-00618-4"]);
    expect(meta.account_no).toBe("248-0-42113-9, 248-6-00618-4");
    expect(meta.row_count_detected).toBe(3);
    expect(lines.map((l) => l.account_no).sort()).toEqual([
      "248-0-42113-9",
      "248-6-00618-4",
      "248-6-00618-4",
    ]);
    expect(lines.map((l) => l.source_sheet_name).sort()).toEqual([
      "248-0-42113-9",
      "248-6-00618-4",
      "248-6-00618-4",
    ]);
    expect(lines.find((l) => l.account_no === "248-0-42113-9")?.direction).toBe("in");
    expect(lines.filter((l) => l.account_no === "248-6-00618-4").every((l) => l.direction === "out")).toBe(
      true,
    );
  });

  it("uses the tab name when Account No. metadata is missing", async () => {
    const { lines, meta } = await parseStatementSheets(
      [
        {
          name: "248-0-42113-9",
          grid: [
            KTB_HEADER,
            ["04/08/2026", "ITBANK", "DDSDT", "Shopee", "", 100, 0, 200, "1193"],
          ],
        },
        {
          name: "248-6-00618-4",
          grid: [
            KTB_HEADER,
            ["05/08/2026", "ITBANK", "PBDWT", "Pay", "", -50, 0, 150, "0248"],
          ],
        },
      ],
      { filename: "6184-1139.xls", bankName: "KTB" },
    );

    expect(meta.account_nos).toEqual(["248-0-42113-9", "248-6-00618-4"]);
    expect(lines).toHaveLength(2);
    expect(lines[0].account_no).toBe("248-0-42113-9");
    expect(lines[1].account_no).toBe("248-6-00618-4");
  });

  it("carries KBANK account metadata from the in tab onto an out tab", async () => {
    const header = ["วันที่", "รายการ", "ถอนเงิน", "ฝากเงิน", "ยอดคงเหลือ"];
    const { lines, meta } = await parseStatementSheets(
      [
        {
          name: "in",
          grid: [
            ["เลขที่บัญชีเงินฝาก", "064-8-91723-6"],
            header,
            ["01/08/2026", "รับโอนเงิน", null, 26508, 1173631.99],
          ],
        },
        {
          name: "out",
          grid: [
            header,
            ["02/08/2026", "โอนเงิน", 5000, null, 1168631.99],
          ],
        },
      ],
      { filename: "7236 W1-23 D8.xlsx", bankName: "KBANK" },
    );

    expect(meta.account_nos).toEqual(["064-8-91723-6"]);
    expect(lines).toHaveLength(2);
    expect(lines.every((l) => l.account_no === "064-8-91723-6")).toBe(true);
    expect(lines.map((l) => l.source_sheet_name)).toEqual(["in", "out"]);
    expect(lines.map((l) => l.direction)).toEqual(["in", "out"]);
  });
});
