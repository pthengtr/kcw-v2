import fs from "fs";
import path from "path";

import {
  BANK_MATCH_PROMPT_RELATIVE_PATH,
} from "@/lib/bank/match-prompt-constants";

export {
  BANK_MATCH_ACCOUNT_NO,
  BANK_MATCH_AGENT_NAME,
  BANK_MATCH_PROMPT_RELATIVE_PATH,
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
  rootDir: string = process.cwd()
): string {
  const filePath = path.join(rootDir, BANK_MATCH_PROMPT_RELATIVE_PATH);
  return fs.readFileSync(filePath, "utf8");
}

export function buildBankMatchPrompt(vars: BankMatchPromptVars): string {
  return fillBankMatchPrompt(loadBankMatchPromptTemplate(), vars);
}
