export const BANK_MATCH_STATUSES = [
  "pending",
  "matched",
  "review",
  "resolved",
  "unmatched",
  "manual",
  "ignored",
] as const;

export type BankMatchStatus = (typeof BANK_MATCH_STATUSES)[number];

/** Rows the match agent may read and overwrite on each run. */
export const AGENT_INPUT_MATCH_STATUSES = [
  "pending",
  "unmatched",
] as const satisfies readonly BankMatchStatus[];

/**
 * @deprecated Prefer `AGENT_INPUT_MATCH_STATUSES` (pending + unmatched).
 * Kept so older imports still resolve; unmatched must also be re-processed
 * because source tables often lag the bank feed.
 */
export const AGENT_WRITABLE_MATCH_STATUS: BankMatchStatus = "pending";

export const AGENT_OUTPUT_MATCH_STATUSES = [
  "matched",
  "review",
  "unmatched",
  "ignored",
] as const satisfies readonly BankMatchStatus[];

const STATUS_SET = new Set<string>(BANK_MATCH_STATUSES);

export function isBankMatchStatus(value: string): value is BankMatchStatus {
  return STATUS_SET.has(value);
}

export function matchStatusLabelTh(status: string): string {
  switch (status) {
    case "pending":
      return "ยังไม่ประมวลผล";
    case "matched":
      return "จับคู่แล้ว";
    case "review":
      return "ต้องตรวจ";
    case "resolved":
      return "ตรวจแล้ว";
    case "unmatched":
      return "จับคู่ไม่ได้";
    case "manual":
      return "จับคู่ด้วยมือ";
    case "ignored":
      return "ไม่ใช้";
    default:
      return status;
  }
}

/** Statuses where operators may edit reason/notes. */
export function canOperatorEditMatchFields(status: string): boolean {
  return [
    "pending",
    "review",
    "unmatched",
    "manual",
    "resolved",
    "ignored",
    "matched",
  ].includes(status);
}

/**
 * Allowed operator status transitions.
 * Same-status updates are always allowed (save edits).
 */
export function canOperatorTransitionMatchStatus(
  from: string,
  to: string
): boolean {
  if (from === to) return true;
  if (!isBankMatchStatus(to)) return false;

  switch (from) {
    case "pending":
      return to === "manual" || to === "ignored";
    case "review":
      return (
        to === "resolved" ||
        to === "ignored" ||
        to === "manual" ||
        to === "pending"
      );
    case "unmatched":
      return to === "manual" || to === "ignored" || to === "pending";
    case "manual":
      return to === "ignored" || to === "resolved" || to === "pending";
    case "resolved":
      return to === "manual" || to === "ignored" || to === "pending";
    case "matched":
      return to === "review" || to === "ignored" || to === "pending";
    case "ignored":
      return to === "pending" || to === "manual" || to === "review";
    default:
      return false;
  }
}

export function operatorMatchBy(email: string): string {
  const clean = email.trim() || "unknown";
  return `operator:${clean}`;
}
