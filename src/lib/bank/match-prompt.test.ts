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

const HQ_7236 = "064-8-91723-6";
const HQ_3557 = "141-1-72355-7";
const SYP_0393 = "064-8-92039-3";
const SYP_4759 = "233-1-18475-9";
const KTB_1139 = "248-0-42113-9";
const KTB_6184 = "248-6-00618-4";

describe("bank match prompt", () => {
  it("supports configured match accounts and Thai button name", () => {
    expect(BANK_MATCH_ACCOUNT_NO).toBe(HQ_7236);
    expect(BANK_MATCH_ACCOUNT_NOS).toEqual([
      HQ_7236,
      HQ_3557,
      SYP_0393,
      SYP_4759,
      KTB_1139,
      KTB_6184,
    ]);
    expect(BANK_MATCH_AGENT_NAME).toBe("จับคู่ยอดเข้า");
    expect(BANK_MATCH_PROMPT_RELATIVE_PATH).toBe(
      "prompts/bank-statement-match-7236.md"
    );
    expect(BANK_MATCH_PROMPTS[HQ_3557]).toBe(
      "prompts/bank-statement-match-3557.md"
    );
    expect(BANK_MATCH_PROMPTS[SYP_0393]).toBe(
      "prompts/bank-statement-match-0393.md"
    );
    expect(BANK_MATCH_PROMPTS[SYP_4759]).toBe(
      "prompts/bank-statement-match-4759.md"
    );
    expect(BANK_MATCH_PROMPTS[KTB_1139]).toBe(
      "prompts/bank-statement-match-1139.md"
    );
    expect(BANK_MATCH_PROMPTS[KTB_6184]).toBe(
      "prompts/bank-statement-match-6184.md"
    );
    expect(isBankMatchAccount(HQ_7236)).toBe(true);
    expect(isBankMatchAccount(HQ_3557)).toBe(true);
    expect(isBankMatchAccount(SYP_0393)).toBe(true);
    expect(isBankMatchAccount(SYP_4759)).toBe(true);
    expect(isBankMatchAccount(KTB_1139)).toBe(true);
    expect(isBankMatchAccount(KTB_6184)).toBe(true);
    expect(isBankMatchAccount("7236")).toBe(false);
    expect(isBankMatchAccount("0393")).toBe(false);
    expect(isBankMatchAccount("1139")).toBe(false);
    expect(isBankMatchAccount("9999")).toBe(false);
    expect(getBankMatchPromptPath(HQ_3557)).toBe(
      "prompts/bank-statement-match-3557.md"
    );
    expect(getBankMatchPromptPath(SYP_0393)).toBe(
      "prompts/bank-statement-match-0393.md"
    );
    expect(getBankMatchPromptPath(SYP_4759)).toBe(
      "prompts/bank-statement-match-4759.md"
    );
    expect(getBankMatchPromptPath(KTB_1139)).toBe(
      "prompts/bank-statement-match-1139.md"
    );
    expect(getBankMatchPromptPath(KTB_6184)).toBe(
      "prompts/bank-statement-match-6184.md"
    );
    expect(ACCOUNT_NO).toBe(BANK_MATCH_ACCOUNT_NO);
    expect(AGENT_NAME).toBe(BANK_MATCH_AGENT_NAME);
    expect(PROMPT_PATH).toBe(BANK_MATCH_PROMPT_RELATIVE_PATH);
  });

  it("loads 7236 prompt and injects webapp scope placeholders", () => {
    const template = loadBankMatchPromptTemplate(HQ_7236);
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
    expect(template).toContain("match_status` in (`pending`, `unmatched`)");
    expect(template).toContain("บิลโอน TR (ใบเดียว)");
    expect(template).toContain("match_notes");
    expect(template).toContain(HQ_7236);
    expect(template).toContain(
      `If \`{{account_no}}\` is not \`${HQ_7236}\``
    );

    const filled = fillBankMatchPrompt(template, {
      account_no: HQ_7236,
      from: "2026-05-01",
      to: "2026-05-31",
    });
    expect(filled).toContain(`Account: \`${HQ_7236}\``);
    expect(filled).toContain("2026-05-01");
    expect(filled).toContain("2026-05-31");
    expect(filled).not.toContain("{{account_no}}");
  });

  it("loads 3557 PVMAS/PIMAS prompt", () => {
    const template = loadBankMatchPromptTemplate(HQ_3557);
    expect(template).toContain("{{account_no}}");
    expect(template).toContain("PVMAS");
    expect(template).toContain("PIMAS");
    expect(template).toContain("raw_hq_pvmas_notes_vouchers");
    expect(template).toContain("raw_hq_pimas_purchase_bills");
    expect(template).toContain("ใบสำคัญจ่าย (วันเดียวกัน)");
    expect(template).toContain("match_status` in (`pending`, `unmatched`)");
    expect(template).toContain("direction = 'out'");
    expect(template).toContain(HQ_3557);
    expect(template).toContain(
      `If \`{{account_no}}\` is not \`${HQ_3557}\``
    );

    const filled = buildBankMatchPrompt({
      account_no: HQ_3557,
      from: "2026-06-01",
      to: "2026-06-30",
    });
    expect(filled).toContain(`Account: \`${HQ_3557}\``);
    expect(filled).toContain("2026-06-01");
    expect(filled).toContain("2026-06-30");
    expect(filled).not.toContain("{{account_no}}");
  });

  it("loads 0393 3TR/3TAR + expense PV prompt", () => {
    const template = loadBankMatchPromptTemplate(SYP_0393);
    expect(template).toContain("{{account_no}}");
    expect(template).toContain("3TR");
    expect(template).toContain("3TAR");
    expect(template).toContain("fin_3tar_lines");
    expect(template).toContain("fin_3cntar_lines");
    expect(template).toContain("expense_receipt");
    expect(template).toContain("expense_pv");
    expect(template).toContain("กสิกร xxxxxx0393");
    expect(template).toContain("คืนเงินสำรอง");
    expect(template).toContain(SYP_4759);
    expect(template).toContain("total_net");
    expect(template).toContain("match_status` in (`pending`, `unmatched`)");
    expect(template).toContain("direction = 'in'");
    expect(template).toContain("direction = 'out'");
    expect(template).toContain(SYP_0393);
    expect(template).toContain(
      `If \`{{account_no}}\` is not \`${SYP_0393}\``
    );

    const filled = buildBankMatchPrompt({
      account_no: SYP_0393,
      from: "2026-05-01",
      to: "2026-05-31",
    });
    expect(filled).toContain(`Account: \`${SYP_0393}\``);
    expect(filled).toContain("2026-05-01");
    expect(filled).toContain("2026-05-31");
    expect(filled).not.toContain("{{account_no}}");
  });

  it("loads 4759 expense PV prompt (OpEx moved from 0393)", () => {
    const template = loadBankMatchPromptTemplate(SYP_4759);
    expect(template).toContain("{{account_no}}");
    expect(template).toContain(SYP_4759);
    expect(template).toContain("expense_receipt");
    expect(template).toContain("expense_pv");
    expect(template).toContain("กสิกร xxxxxx4759");
    expect(template).toContain("คืนเงินสำรอง");
    expect(template).toContain("total_net");
    expect(template).toContain("internal_transfer");
    expect(template).toContain("No sales matching");
    expect(template).toContain("3TR");
    expect(template).toContain("match_status` in (`pending`, `unmatched`)");
    expect(template).toContain("direction = 'out'");
    expect(template).toContain("agent:bank-matcher-4759-v1");
    expect(template).toContain("ใบสำคัญจ่าย PV (วันเดียวกัน)");
    expect(template).toContain(
      `If \`{{account_no}}\` is not \`${SYP_4759}\``
    );

    const filled = buildBankMatchPrompt({
      account_no: SYP_4759,
      from: "2026-07-01",
      to: "2026-07-31",
    });
    expect(filled).toContain(`Account: \`${SYP_4759}\``);
    expect(filled).toContain("2026-07-01");
    expect(filled).toContain("2026-07-31");
    expect(filled).not.toContain("{{account_no}}");
  });

  it("loads 1139 / 248-0-42113-9 RVI marketplace prompt", () => {
    const template = loadBankMatchPromptTemplate(KTB_1139);
    expect(template).toContain("{{account_no}}");
    expect(template).toContain("{{from}}");
    expect(template).toContain("{{to}}");
    expect(template).toContain(KTB_1139);
    expect(template).toContain("RVI");
    expect(template).toContain("raw_hq_rvmas_notes_vouchers");
    expect(template).toContain("ใบสำคัญรับเงินออนไลน์ RVI (วันเดียวกัน)");
    expect(template).toContain("internal_transfer");
    expect(template).toContain("Do **not** match individual TAD");
    expect(template).toContain("match_status` in (`pending`, `unmatched`)");
    expect(template).toContain("agent:bank-matcher-1139-v1");
    expect(template).toContain(HQ_7236);

    const filled = buildBankMatchPrompt({
      account_no: KTB_1139,
      from: "2026-05-01",
      to: "2026-05-31",
    });
    expect(filled).toContain(`Account: \`${KTB_1139}\``);
    expect(filled).toContain("2026-05-01");
    expect(filled).toContain("2026-05-31");
    expect(filled).not.toContain("{{account_no}}");
  });

  it("loads 6184 payroll/expense cheque prompt", () => {
    const template = loadBankMatchPromptTemplate(KTB_6184);
    expect(template).toContain("{{account_no}}");
    expect(template).toContain(KTB_6184);
    expect(template).toContain("expense_receipt");
    expect(template).toContain("payment_method");
    expect(template).toContain("expense_payroll");
    expect(template).toContain("expense_pv");
    expect(template).toContain("bank_cheque");
    expect(template).toContain("do nothing");
    expect(template).toContain("direction = 'in'");
    expect(template).toContain("match_status` in (`pending`, `unmatched`)");
    expect(template).toContain("agent:bank-matcher-6184-v1");
    expect(template).toContain("เงินเดือน (PAY1 รวมส่วนต่าง)");
    expect(template).toContain("ใบสำคัญจ่าย PV (ค่าสาธารณูปโภค)");
    expect(template).toContain(SYP_0393);
    expect(template).toContain(SYP_4759);
    expect(template).not.toContain("<<<<<<<");
    expect(template).not.toContain(">>>>>>>");

    const filled = buildBankMatchPrompt({
      account_no: KTB_6184,
      from: "2026-05-01",
      to: "2026-06-30",
    });
    expect(filled).toContain(`Account: \`${KTB_6184}\``);
    expect(filled).toContain("2026-05-01");
    expect(filled).toContain("2026-06-30");
    expect(filled).not.toContain("{{account_no}}");
  });
});
