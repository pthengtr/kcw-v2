import { describe, expect, it } from "vitest";

import {
  BANK_MATCH_ACCOUNT_NO,
  BANK_MATCH_AGENT_NAME,
  BANK_MATCH_PROMPT_RELATIVE_PATH,
  fillBankMatchPrompt,
  loadBankMatchPromptTemplate,
} from "@/lib/bank/match-prompt";

describe("bank match prompt", () => {
  it("targets account 7236 and uses Thai hawk-eye agent name", () => {
    expect(BANK_MATCH_ACCOUNT_NO).toBe("7236");
    expect(BANK_MATCH_AGENT_NAME).toBe("สายตาเหยี่ยว");
    expect(BANK_MATCH_PROMPT_RELATIVE_PATH).toBe(
      "prompts/bank-statement-match-7236.md"
    );
  });

  it("loads v1 prompt and injects webapp scope placeholders", () => {
    const template = loadBankMatchPromptTemplate();
    expect(template).toContain("{{account_no}}");
    expect(template).toContain("{{from}}");
    expect(template).toContain("{{to}}");
    expect(template).toContain("บิลโอน TR");
    expect(template).toContain("TAR");
    expect(template).toContain("RVMAS");

    const filled = fillBankMatchPrompt(template, {
      account_no: "7236",
      from: "2026-05-01",
      to: "2026-05-31",
    });
    expect(filled).toContain("บัญชี: `7236`");
    expect(filled).toContain("2026-05-01");
    expect(filled).toContain("2026-05-31");
    expect(filled).not.toContain("{{account_no}}");
  });
});
