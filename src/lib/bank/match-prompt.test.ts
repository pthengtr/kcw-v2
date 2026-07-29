import { describe, expect, it } from "vitest";

import {
  BANK_MATCH_ACCOUNT_NO,
  BANK_MATCH_AGENT_NAME,
  BANK_MATCH_PROMPT_RELATIVE_PATH,
  fillBankMatchPrompt,
  loadBankMatchPromptTemplate,
} from "@/lib/bank/match-prompt";
import {
  BANK_MATCH_ACCOUNT_NO as ACCOUNT_NO,
  BANK_MATCH_AGENT_NAME as AGENT_NAME,
  BANK_MATCH_PROMPT_RELATIVE_PATH as PROMPT_PATH,
} from "@/lib/bank/match-prompt-constants";

describe("bank match prompt", () => {
  it("targets account 7236 and uses plain Thai match button name", () => {
    expect(BANK_MATCH_ACCOUNT_NO).toBe("7236");
    expect(BANK_MATCH_AGENT_NAME).toBe("จับคู่ยอดเข้า");
    expect(BANK_MATCH_PROMPT_RELATIVE_PATH).toBe(
      "prompts/bank-statement-match-7236.md"
    );
    expect(ACCOUNT_NO).toBe(BANK_MATCH_ACCOUNT_NO);
    expect(AGENT_NAME).toBe(BANK_MATCH_AGENT_NAME);
    expect(PROMPT_PATH).toBe(BANK_MATCH_PROMPT_RELATIVE_PATH);
  });

  it("loads v1 prompt and injects webapp scope placeholders", () => {
    const template = loadBankMatchPromptTemplate();
    expect(template).toContain("{{account_no}}");
    expect(template).toContain("{{from}}");
    expect(template).toContain("{{to}}");
    expect(template).toContain("TR transfer bills");
    expect(template).toContain("TAR");
    expect(template).toContain("RVMAS");
    expect(template).toContain("K SHOP");
    expect(template).toContain("interest_income");
    expect(template).toContain("credit_note_refund");
    expect(template).toContain("Non-VAT SIDET");
    expect(template).toContain("Account: `{{account_no}}`");
    // Operator-facing values stored on rows stay Thai.
    expect(template).toContain("บิลโอน TR (ใบเดียว)");
    expect(template).toContain("match_notes");

    const filled = fillBankMatchPrompt(template, {
      account_no: "7236",
      from: "2026-05-01",
      to: "2026-05-31",
    });
    expect(filled).toContain("Account: `7236`");
    expect(filled).toContain("2026-05-01");
    expect(filled).toContain("2026-05-31");
    expect(filled).not.toContain("{{account_no}}");
  });
});