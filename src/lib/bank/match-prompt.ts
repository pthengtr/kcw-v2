import fs from "fs";
import path from "path";

export const BANK_MATCH_ACCOUNT_NO = "7236";
export const BANK_MATCH_PROMPT_RELATIVE_PATH =
  "prompts/bank-statement-match-7236.md";
export const BANK_MATCH_AGENT_NAME = "สายตาเหยี่ยว";

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
