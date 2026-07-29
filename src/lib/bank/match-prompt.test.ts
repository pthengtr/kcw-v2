import { describe, expect, it } from "vitest";

import {
  BANK_MATCH_ACCOUNT_NO,
  BANK_MATCH_ACCOUNT_NOS,
  BANK_MATCH_AGENT_NAME,
  BANK_MATCH_PROMPT_RELATIVE_PATH,
  BANK_MATCH_PROMPTS,
  buildBankMatchPrompt,
  fillBankMatchPrompt,
  getBankMatchPromptPath,
  isBankMatchAccount,
  loadBankMatchPromptTemplate,
} from "@/lib/bank/match-prompt";
import {
  BANK_MATCH_ACCOUNT_NO as ACCOUNT_NO,
  BANK_MATCH_AGENT_NAME as AGENT_NAME,
  BANK_MATCH_PROMPT_RELATIVE_PATH as PROMPT_PATH,
} from "@/lib/bank/match-prompt-constants";

describe("bank match prompt", () => {
  it("supports configured match accounts and Thai button name", () => {
    expect(BANK_MATCH_ACCOUNT_NO).toBe("7236");
    expect(BANK_MATCH_ACCOUNT_NOS).toEqual([
      "7236",
      "3557",
      "248-0-42113-9",
    ]);
    expect(BANK_MATCH_AGENT_NAME).toBe("จับคู่ยอดเข้า");
    expect(BANK_MATCH_PROMPT_RELATIVE_PATH).toBe(
      "prompts/bank-statement-match-7236.md"
    );
    expect(BANK_MATCH_PROMPTS["3557"]).toBe(
      "prompts/bank-statement-match-3557.md"
    );
    expect(BANK_MATCH_PROMPTS["248-0-42113-9"]).toBe(
      "prompts/bank-statement-match-1139.md"
    );
    expect(isBankMatchAccount("7236")).toBe(true);
    expect(isBankMatchAccount("3557")).toBe(true);
    expect(isBankMatchAccount("248-0-42113-9")).toBe(true);
    expect(isBankMatchAccount("1139")).toBe(false);
    expect(isBankMatchAccount("9999")).toBe(false);
    expect(getBankMatchPromptPath("3557")).toBe(
      "prompts/bank-statement-match-3557.md"
    );
    expect(getBankMatchPromptPath("248-0-42113-9")).toBe(
      "prompts/bank-statement-match-1139.md"
    );
    expect(ACCOUNT_NO).toBe(BANK_MATCH_ACCOUNT_NO);
    expect(AGENT_NAME).toBe(BANK_MATCH_AGENT_NAME);
    expect(PROMPT_PATH).toBe(BANK_MATCH_PROMPT_RELATIVE_PATH);
  });

  it("loads 7236 prompt and injects webapp scope placeholders", () => {
    const template = loadBankMatchPromptTemplate("7236");
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
    expect(template).toContain("match_status = 'pending'");
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

  it("loads 3557 PVMAS/PIMAS prompt", () => {
    const template = loadBankMatchPromptTemplate("3557");
    expect(template).toContain("{{account_no}}");
    expect(template).toContain("PVMAS");
    expect(template).toContain("PIMAS");
    expect(template).toContain("raw_hq_pvmas_notes_vouchers");
    expect(template).toContain("raw_hq_pimas_purchase_bills");
    expect(template).toContain("ใบสำคัญจ่าย (วันเดียวกัน)");
    expect(template).toContain("match_status = 'pending'");
    expect(template).toContain("direction = 'out'");

    const filled = buildBankMatchPrompt({
      account_no: "3557",
      from: "2026-06-01",
      to: "2026-06-30",
    });
    expect(filled).toContain("Account: `3557`");
    expect(filled).toContain("2026-06-01");
    expect(filled).toContain("2026-06-30");
    expect(filled).not.toContain("{{account_no}}");
  });

  it("loads 1139 / 248-0-42113-9 RVI marketplace prompt", () => {
    const template = loadBankMatchPromptTemplate("248-0-42113-9");
    expect(template).toContain("{{account_no}}");
    expect(template).toContain("{{from}}");
    expect(template).toContain("{{to}}");
    expect(template).toContain("248-0-42113-9");
    expect(template).toContain("RVI");
    expect(template).toContain("raw_hq_rvmas_notes_vouchers");
    expect(template).toContain("ใบสำคัญรับเงินออนไลน์ RVI (วันเดียวกัน)");
    expect(template).toContain("internal_transfer");
    expect(template).toContain("Do **not** match individual TAD");
    expect(template).toContain("match_status = 'pending'");
    expect(template).toContain("agent:bank-matcher-1139-v1");

    const filled = buildBankMatchPrompt({
      account_no: "248-0-42113-9",
      from: "2026-05-01",
      to: "2026-05-31",
    });
    expect(filled).toContain("Account: `248-0-42113-9`");
    expect(filled).toContain("2026-05-01");
    expect(filled).toContain("2026-05-31");
    expect(filled).not.toContain("{{account_no}}");
  });
});
