import type { BadgeProps } from "@/components/ui/badge";

const SENSITIVE_KEY_RE =
  /^(authorization|token|secret|password|apikey|servicerolekey|qrimage)$/i;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getUnknown(
  value: unknown,
  ...path: Array<string | number>
): unknown {
  let current: unknown = value;
  for (const key of path) {
    if (typeof key === "number") {
      if (!Array.isArray(current)) return undefined;
      current = current[key];
      continue;
    }
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

export function asString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return null;
}

export function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function displayValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? "—" : trimmed;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "—";
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  return "—";
}

export function humanizeToken(value: string): string {
  const spaced = value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!spaced) return value;
  return spaced
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function formatBaht(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} บาท`;
}

export function formatBangkokDateTime(
  value: string | null | undefined
): string {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export type TigerPayStatusPresentation = {
  label: string;
  variant: BadgeProps["variant"];
  tone: "success" | "pending" | "info" | "cancelled" | "unknown";
  icon: "check" | "clock" | "review" | "coins" | "x" | "circle";
};

export function getTigerPayStatusPresentation(
  status: string | null | undefined
): TigerPayStatusPresentation {
  const normalized = (status ?? "").trim().toLowerCase();

  switch (normalized) {
    case "success":
      return {
        label: "Successful",
        variant: "secondary",
        tone: "success",
        icon: "check",
      };
    case "pending":
      return {
        label: "Receiving payment",
        variant: "outline",
        tone: "pending",
        icon: "clock",
      };
    case "pendingapproval":
      return {
        label: "Pending approval",
        variant: "outline",
        tone: "pending",
        icon: "review",
      };
    case "change":
      return {
        label: "Dispensing change",
        variant: "outline",
        tone: "info",
        icon: "coins",
      };
    case "cancel":
      return {
        label: "Cancelled",
        variant: "destructive",
        tone: "cancelled",
        icon: "x",
      };
    default:
      return {
        label: status ? humanizeToken(status) : "Unknown",
        variant: "outline",
        tone: "unknown",
        icon: "circle",
      };
  }
}

export function getTigerPayEventTitle(
  status: string | null | undefined
): string {
  const normalized = (status ?? "").trim().toLowerCase();
  switch (normalized) {
    case "pending":
      return "Payment started";
    case "change":
      return "Dispensing change";
    case "pendingapproval":
      return "Waiting for approval";
    case "success":
      return "Payment completed";
    case "cancel":
      return "Payment cancelled";
    default:
      return status ? humanizeToken(status) : "Unknown event";
  }
}

export function formatPaymentType(value: string | null | undefined): string {
  const normalized = (value ?? "").trim().toLowerCase();
  switch (normalized) {
    case "cash":
      return "Cash";
    case "promptpay":
      return "PromptPay";
    case "qr":
      return "Dynamic QR";
    default:
      return value ? humanizeToken(value) : "—";
  }
}

export function maskAccountValue(value: unknown): string {
  const raw = asString(value);
  if (!raw) return "—";
  const cleaned = raw.replace(/\s+/g, "");
  if (!cleaned) return "—";
  if (cleaned.length <= 4) return "****";
  const visible = cleaned.slice(-4);
  const hiddenLength = Math.max(4, cleaned.length - 4);
  return `${"*".repeat(hiddenLength)}${visible}`;
}

export function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item));
  }
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      out[key] = SENSITIVE_KEY_RE.test(key)
        ? "[REDACTED]"
        : redactSensitive(nested);
    }
    return out;
  }
  return value;
}

export function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function shortId(value: string | null | undefined, size = 8): string {
  if (!value) return "—";
  if (value.length <= size) return value;
  return `${value.slice(0, size)}…`;
}

export function buildLifecycleSummary(
  statuses: Array<string | null | undefined>
): string {
  const titles: string[] = [];
  for (const status of statuses) {
    const title = getTigerPayEventTitle(status);
    if (titles[titles.length - 1] === title) continue;
    titles.push(title);
  }
  return titles.join(" → ");
}

export function isNumericSearch(search: string): boolean {
  return /^\d+$/.test(search.trim());
}
