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

/** Rows chat-agent matchers may read and overwrite on each run. */
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

/** Agents may set these; `ignored` is operator-only (exclude from monthly report). */
export const AGENT_OUTPUT_MATCH_STATUSES = [
  "matched",
  "review",
  "unmatched",
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

/** Operator/agent matched_ref_type values used by cashflow BI buckets. */
export const BANK_MATCHED_REF_TYPES = [
  "rvi",
  "tr_bill",
  "tr_bundle",
  "tr_remainder",
  "3tr_bill",
  "tar_cntar_net",
  "rvmas",
  "interest_income",
  "vendor_rebate",
  "sales_adjustment",
  "internal_transfer",
  "pvmas",
  "pimas",
  "pimas_possible_bundle",
  "bank_cheque",
  "expense_pv",
  "expense_payroll",
  "employee_advance",
  "withholding_tax",
  "bank_fee",
  "possible_duplicate",
] as const;

export type BankMatchedRefType = (typeof BANK_MATCHED_REF_TYPES)[number];

const MATCHED_REF_TYPE_SET = new Set<string>(BANK_MATCHED_REF_TYPES);

export function isBankMatchedRefType(
  value: string
): value is BankMatchedRefType {
  return MATCHED_REF_TYPE_SET.has(value);
}

/** Normalize free-text / legacy casing to a known ref type when possible. */
export function normalizeBankMatchedRefType(
  value: string | null | undefined
): BankMatchedRefType | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (isBankMatchedRefType(lower)) return lower;
  return null;
}

export function matchedRefTypeLabelTh(value: string): string {
  switch (value) {
    case "rvi":
      return "รับเงินตลาดออนไลน์ (RVI)";
    case "tr_bill":
      return "บิลโอน";
    case "tr_bundle":
      return "บิลโอนรวม";
    case "tr_remainder":
      return "บิลโอนส่วนต่าง";
    case "3tr_bill":
      return "บิลโอน (3TR)";
    case "tar_cntar_net":
      return "รับชำระลูกหนี้ (TAR)";
    case "rvmas":
      return "ใบสำคัญรับ (RVMAS)";
    case "interest_income":
      return "ดอกเบี้ยรับ";
    case "vendor_rebate":
      return "ส่วนลดผู้ขาย";
    case "sales_adjustment":
      return "ปรับปรุงยอดขาย";
    case "internal_transfer":
      return "โอนระหว่างบัญชี";
    case "pvmas":
      return "จ่ายเจ้าหนี้ (PVMAS)";
    case "pimas":
      return "จ่ายซื้อสินค้า (PIMAS)";
    case "pimas_possible_bundle":
      return "จ่ายซื้อสินค้า (bundle)";
    case "bank_cheque":
      return "เช็ค";
    case "expense_pv":
      return "ค่าใช้จ่าย (PV)";
    case "expense_payroll":
      return "เงินเดือน";
    case "employee_advance":
      return "เบิกล่วงหน้า";
    case "withholding_tax":
      return "หัก ณ ที่จ่าย";
    case "bank_fee":
      return "ค่าธรรมเนียมธนาคาร";
    case "possible_duplicate":
      return "อาจเป็นแถวซ้ำ";
    default:
      return value;
  }
}

/** Dropdown options grouped for the operator UI. */
export const BANK_MATCHED_REF_TYPE_OPTIONS: ReadonlyArray<{
  value: BankMatchedRefType;
  label: string;
  group: "in" | "out" | "other";
}> = [
  { value: "rvi", label: matchedRefTypeLabelTh("rvi"), group: "in" },
  { value: "tr_bill", label: matchedRefTypeLabelTh("tr_bill"), group: "in" },
  {
    value: "tr_bundle",
    label: matchedRefTypeLabelTh("tr_bundle"),
    group: "in",
  },
  {
    value: "tr_remainder",
    label: matchedRefTypeLabelTh("tr_remainder"),
    group: "in",
  },
  { value: "3tr_bill", label: matchedRefTypeLabelTh("3tr_bill"), group: "in" },
  {
    value: "tar_cntar_net",
    label: matchedRefTypeLabelTh("tar_cntar_net"),
    group: "in",
  },
  { value: "rvmas", label: matchedRefTypeLabelTh("rvmas"), group: "in" },
  {
    value: "interest_income",
    label: matchedRefTypeLabelTh("interest_income"),
    group: "in",
  },
  {
    value: "vendor_rebate",
    label: matchedRefTypeLabelTh("vendor_rebate"),
    group: "in",
  },
  {
    value: "sales_adjustment",
    label: matchedRefTypeLabelTh("sales_adjustment"),
    group: "in",
  },
  {
    value: "internal_transfer",
    label: matchedRefTypeLabelTh("internal_transfer"),
    group: "other",
  },
  { value: "pvmas", label: matchedRefTypeLabelTh("pvmas"), group: "out" },
  { value: "pimas", label: matchedRefTypeLabelTh("pimas"), group: "out" },
  {
    value: "pimas_possible_bundle",
    label: matchedRefTypeLabelTh("pimas_possible_bundle"),
    group: "out",
  },
  {
    value: "bank_cheque",
    label: matchedRefTypeLabelTh("bank_cheque"),
    group: "out",
  },
  {
    value: "expense_pv",
    label: matchedRefTypeLabelTh("expense_pv"),
    group: "out",
  },
  {
    value: "expense_payroll",
    label: matchedRefTypeLabelTh("expense_payroll"),
    group: "out",
  },
  {
    value: "employee_advance",
    label: matchedRefTypeLabelTh("employee_advance"),
    group: "out",
  },
  {
    value: "withholding_tax",
    label: matchedRefTypeLabelTh("withholding_tax"),
    group: "out",
  },
  {
    value: "bank_fee",
    label: matchedRefTypeLabelTh("bank_fee"),
    group: "out",
  },
  {
    value: "possible_duplicate",
    label: matchedRefTypeLabelTh("possible_duplicate"),
    group: "other",
  },
];

