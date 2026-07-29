import { describe, expect, it } from "vitest";

import {
  canOperatorEditMatchFields,
  canOperatorTransitionMatchStatus,
  isBankMatchStatus,
  matchStatusLabelTh,
  operatorMatchBy,
} from "@/lib/bank/match-status";

describe("bank match status workflow", () => {
  it("recognizes workflow statuses", () => {
    expect(isBankMatchStatus("pending")).toBe(true);
    expect(isBankMatchStatus("resolved")).toBe(true);
    expect(isBankMatchStatus("manual")).toBe(true);
    expect(isBankMatchStatus("open")).toBe(false);
  });

  it("labels statuses in Thai", () => {
    expect(matchStatusLabelTh("pending")).toBe("ยังไม่ประมวลผล");
    expect(matchStatusLabelTh("resolved")).toBe("ตรวจแล้ว");
    expect(matchStatusLabelTh("manual")).toBe("จับคู่ด้วยมือ");
    expect(matchStatusLabelTh("unmatched")).toBe("จับคู่ไม่ได้");
  });

  it("allows operator queue transitions", () => {
    expect(canOperatorTransitionMatchStatus("review", "resolved")).toBe(true);
    expect(canOperatorTransitionMatchStatus("unmatched", "manual")).toBe(true);
    expect(canOperatorTransitionMatchStatus("pending", "manual")).toBe(true);
    expect(canOperatorTransitionMatchStatus("matched", "pending")).toBe(false);
    expect(canOperatorEditMatchFields("review")).toBe(true);
  });

  it("formats operator matched_by", () => {
    expect(operatorMatchBy("ada@example.com")).toBe("operator:ada@example.com");
  });
});
