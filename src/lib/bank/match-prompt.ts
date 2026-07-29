import fs from "fs";
import path from "path";

import {
  getBankMatchPromptPath,
  isBankMatchAccount,
} from "@/lib/bank/match-prompt-constants";

export {
  BANK_MATCH_ACCOUNT_NO,
  BANK_MATCH_ACCOUNT_NOS,
  BANK_MATCH_AGENT_NAME,
  BANK_MATCH_PROMPT_RELATIVE_PATH,
  BANK_MATCH_PROMPTS,
  bankMatchAccountsLabel,
  getBankMatchPromptPath,
  isBankMatchAccount,
} from "@/lib/bank/match-prompt-constants";

export type BankMatchPromptVars = {
  account_no: string;
  from: string;
  to: string;
};

export function fillBankMatchPrompt(
  template: string,
  vars: BankMatchPromptVars
): string {
  return template
    .replaceAll("{{account_no}}", vars.account_no)
    .replaceAll("{{from}}", vars.from)
    .replaceAll("{{to}}", vars.to);
}

export function loadBankMatchPromptTemplate(
  accountNo: string,
  rootDir: string = process.cwd()
): string {
  const relativePath = getBankMatchPromptPath(accountNo);
  if (!relativePath) {
    throw new Error(`No match prompt configured for account ${accountNo}`);
  }
  const filePath = path.join(rootDir, relativePath);
  return fs.readFileSync(filePath, "utf8");
}

export function buildBankMatchPrompt(vars: BankMatchPromptVars): string {
  if (!isBankMatchAccount(vars.account_no)) {
    throw new Error(`No match prompt configured for account ${vars.account_no}`);
  }
  return fillBankMatchPrompt(
    loadBankMatchPromptTemplate(vars.account_no),
    vars
  );
}
