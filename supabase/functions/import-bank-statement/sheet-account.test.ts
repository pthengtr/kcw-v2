import { describe, expect, it } from "vitest";

import {
  extractAccountFromSheetName,
  formatFileAccountNo,
  resolveSheetAccount,
  uniqueAccountNos,
} from "./sheet-account.ts";

describe("extractAccountFromSheetName", () => {
  it("reads dashed Thai account numbers from KTB tab names", () => {
    expect(extractAccountFromSheetName("248-0-42113-9")).toBe("248-0-42113-9");
    expect(extractAccountFromSheetName("248-6-00618-4")).toBe("248-6-00618-4");
  });

  it("ignores layout / month / in-out tab names", () => {
    expect(extractAccountFromSheetName("DownLoadService")).toBe("");
    expect(extractAccountFromSheetName("Account_Statement_Report_TH_XLS")).toBe(
      "",
    );
    expect(extractAccountFromSheetName("in")).toBe("");
    expect(extractAccountFromSheetName("out")).toBe("");
    expect(extractAccountFromSheetName("Sheet1")).toBe("");
  });
});

describe("resolveSheetAccount", () => {
  it("prefers in-sheet metadata over the tab name", () => {
    expect(
      resolveSheetAccount({
        metadataAccount: "248-0-42113-9",
        sheetName: "248-6-00618-4",
        fallbackAccount: "6184",
      }),
    ).toBe("248-0-42113-9");
  });

  it("uses the tab name when metadata is missing", () => {
    expect(
      resolveSheetAccount({
        metadataAccount: "",
        sheetName: "248-0-42113-9",
        fallbackAccount: "6184",
      }),
    ).toBe("248-0-42113-9");
  });

  it("carries the previous sheet account onto in/out tabs", () => {
    expect(
      resolveSheetAccount({
        metadataAccount: "",
        sheetName: "out",
        carriedAccount: "064-8-91723-6",
        fallbackAccount: "7236",
      }),
    ).toBe("064-8-91723-6");
  });
});

describe("formatFileAccountNo", () => {
  it("joins unique accounts so import-file ilike still matches either one", () => {
    expect(
      formatFileAccountNo(["248-6-00618-4", "248-0-42113-9", "248-6-00618-4"]),
    ).toBe("248-0-42113-9, 248-6-00618-4");
    expect(uniqueAccountNos(["", " 248-0-42113-9 "])).toEqual(["248-0-42113-9"]);
  });
});
