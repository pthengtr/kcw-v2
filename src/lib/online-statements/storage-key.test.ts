import { describe, expect, it } from "vitest";

import {
  onlineStatementNames,
  onlineStatementStoragePath,
} from "@/lib/online-statements/storage-key";

/** Storage isValidKey: ASCII word chars plus a fixed punctuation set. `\w` is ASCII. */
const STORAGE_KEY = /^(\w|\/|!|-|\.|\*|'|\(|\)| |&|\$|@|=|;|:|\+|,|\?)*$/;

describe("online statement storage keys", () => {
  it("drops Thai from the object name and keeps it on the display name", () => {
    expect(onlineStatementNames("7SPNT 29-5.10.69 ยอด 38970.xlsx")).toEqual({
      displayName: "7SPNT_29-5.10.69_ยอด_38970.xlsx",
      storageName: "7SPNT_29-5.10.69_38970.xlsx",
    });
    expect(onlineStatementNames("7IAPS 2-5.10.69 ยอด 1121.xlsx")).toEqual({
      displayName: "7IAPS_2-5.10.69_ยอด_1121.xlsx",
      storageName: "7IAPS_2-5.10.69_1121.xlsx",
    });
  });

  it("builds a key Storage accepts for the Shopee files that failed", () => {
    const cases = [
      ["7SPNT 29-5.10.69 ยอด 38970.xlsx", "2abcaa0d-83d9-4568-b808-49a842a6ad82"],
      ["7IAPS 2-5.10.69 ยอด 1121.xlsx", "d26fba5c-6902-4afc-8889-e2987bf3b488"],
    ] as const;
    for (const [filename, id] of cases) {
      const names = onlineStatementNames(filename);
      expect(names).not.toBeNull();
      const path = onlineStatementStoragePath("shopee", id, names!.storageName);
      expect(path).not.toContain("ยอด");
      expect(STORAGE_KEY.test(path)).toBe(true);
      expect(
        STORAGE_KEY.test(
          `shopee/${id}_${filename.replace(/[^\w.\-()\u0E00-\u0E7F]+/g, "_")}`
        )
      ).toBe(false);
    }
  });

  it("leaves an ASCII workbook name unchanged", () => {
    expect(onlineStatementNames("ICE_week_28-04.xlsx")).toEqual({
      displayName: "ICE_week_28-04.xlsx",
      storageName: "ICE_week_28-04.xlsx",
    });
  });

  it("falls back when the stem is only Thai", () => {
    expect(onlineStatementNames("ยอด.xlsx")).toEqual({
      displayName: "ยอด.xlsx",
      storageName: "statement.xlsx",
    });
  });

  it("rejects a non-xlsx name and ignores directories", () => {
    expect(onlineStatementNames("report.csv")).toBeNull();
    expect(onlineStatementNames("")).toBeNull();
    expect(onlineStatementNames("../../secret.xlsx")).toEqual({
      displayName: "secret.xlsx",
      storageName: "secret.xlsx",
    });
  });

  it("collapses dot-dot so the key cannot leave the folder", () => {
    expect(onlineStatementNames("foo..bar.xlsx")).toEqual({
      displayName: "foo.bar.xlsx",
      storageName: "foo.bar.xlsx",
    });
  });
});
