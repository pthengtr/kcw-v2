import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import {
  buildLifecycleSummary,
  formatBaht,
  formatBangkokDateTime,
  formatPaymentType,
  getTigerPayEventTitle,
  getTigerPayStatusPresentation,
  isNumericSearch,
  maskAccountValue,
  redactSensitive,
} from "@/lib/bank/tiger-pay-format";
import {
  KNOWN_STATUSES,
  PENDING_STATUSES,
} from "@/lib/bank/tiger-pay-types";

const ROOT = process.cwd();

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function listFiles(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

describe("Tiger Pay integration placement", () => {
  it("appears inside the existing bank statement sync structure", () => {
    const page = read("src/components/bank/BankStatementSyncPage.tsx");
    expect(page).toContain('value="tiger-pay"');
    expect(page).toContain("TigerPayTab");
    expect(page).toContain("Tiger Pay");
  });

  it("does not create a standalone Tiger Pay navigation page", () => {
    const pageFiles = listFiles(path.join(ROOT, "src/app")).filter((file) =>
      /page\.tsx?$/.test(file)
    );
    const standalonePages = pageFiles.filter((file) =>
      /tiger[-_]?pay/i.test(path.relative(path.join(ROOT, "src/app"), file))
    );
    expect(standalonePages).toEqual([]);

    const navbar = read("src/components/nav/Navbar.tsx");
    expect(navbar.toLowerCase()).not.toContain("tiger");
  });
});

describe("Tiger Pay query schema usage", () => {
  it("queries the tiger_pay custom schema", () => {
    const queries = read("src/lib/bank/tiger-pay-queries.ts");
    expect(queries).toContain('.schema("tiger_pay")');
    expect(queries).toContain('.from("payment_transaction")');
    expect(queries).toContain('.from("webhook_event")');
  });
});

describe("Tiger Pay status presentation", () => {
  it("displays successful status correctly", () => {
    const presentation = getTigerPayStatusPresentation("success");
    expect(presentation.label).toBe("Successful");
    expect(presentation.tone).toBe("success");
    expect(presentation.icon).toBe("check");
  });

  it("groups pending, pendingapproval, and change as pending tones", () => {
    expect(PENDING_STATUSES).toEqual([
      "pending",
      "pendingapproval",
      "change",
    ]);
    expect(getTigerPayStatusPresentation("pending").tone).toBe("pending");
    expect(getTigerPayStatusPresentation("pendingapproval").tone).toBe(
      "pending"
    );
    expect(getTigerPayStatusPresentation("change").tone).toBe("info");
    expect(getTigerPayStatusPresentation("pending").label).toBe(
      "Receiving payment"
    );
    expect(getTigerPayStatusPresentation("pendingapproval").label).toBe(
      "Pending approval"
    );
    expect(getTigerPayStatusPresentation("change").label).toBe(
      "Dispensing change"
    );
  });

  it("displays cancel correctly", () => {
    const presentation = getTigerPayStatusPresentation("cancel");
    expect(presentation.label).toBe("Cancelled");
    expect(presentation.tone).toBe("cancelled");
    expect(presentation.icon).toBe("x");
  });

  it("keeps unknown statuses visible", () => {
    const presentation = getTigerPayStatusPresentation("awaiting_machine");
    expect(presentation.label).toContain("Awaiting");
    expect(presentation.variant).toBe("outline");
    expect(KNOWN_STATUSES).not.toContain("awaiting_machine");
  });
});

describe("Tiger Pay formatting", () => {
  it("formats monetary values as Thai baht", () => {
    expect(formatBaht(1234.5)).toContain("1,234.50");
    expect(formatBaht(1234.5)).toContain("บาท");
    expect(formatBaht(null)).toBe("—");
  });

  it("formats timestamps in Asia/Bangkok", () => {
    const formatted = formatBangkokDateTime("2024-01-01T17:00:00.000Z");
    expect(formatted).not.toBe("—");
    // 17:00 UTC is 00:00 next day in Bangkok (+7)
    expect(formatted).toMatch(/2/);
  });

  it("maps payment types to readable labels", () => {
    expect(formatPaymentType("cash")).toBe("Cash");
    expect(formatPaymentType("promptpay")).toBe("PromptPay");
    expect(formatPaymentType("qr")).toBe("Dynamic QR");
    expect(formatPaymentType("wallet_xyz")).toContain("Wallet");
  });
});

describe("Tiger Pay event history helpers", () => {
  it("orders lifecycle titles from recorded statuses only", () => {
    expect(
      buildLifecycleSummary(["pending", "change", "success"])
    ).toBe("Payment started → Dispensing change → Payment completed");
    expect(
      buildLifecycleSummary(["pendingapproval", "cancel"])
    ).toBe("Waiting for approval → Payment cancelled");
  });

  it("identifies event titles used for current-state labeling", () => {
    expect(getTigerPayEventTitle("success")).toBe("Payment completed");
    expect(getTigerPayEventTitle("pending")).toBe("Payment started");
  });
});

describe("Tiger Pay privacy helpers", () => {
  it("masks account values", () => {
    expect(maskAccountValue("1234567890")).toBe("******7890");
    expect(maskAccountValue("12")).toBe("****");
    expect(maskAccountValue(null)).toBe("—");
  });

  it("redacts sensitive keys in raw JSON", () => {
    const redacted = redactSensitive({
      authorization: "secret-token",
      Token: "abc",
      nested: {
        password: "p@ss",
        apiKey: "key",
        serviceRoleKey: "srv",
        qrImage: "base64",
        safe: "ok",
      },
    }) as Record<string, unknown>;

    expect(redacted.authorization).toBe("[REDACTED]");
    expect(redacted.Token).toBe("[REDACTED]");
    const nested = redacted.nested as Record<string, unknown>;
    expect(nested.password).toBe("[REDACTED]");
    expect(nested.apiKey).toBe("[REDACTED]");
    expect(nested.serviceRoleKey).toBe("[REDACTED]");
    expect(nested.qrImage).toBe("[REDACTED]");
    expect(nested.safe).toBe("ok");
  });
});

describe("Tiger Pay detail loading behavior", () => {
  it("loads event history from a dedicated detail endpoint", () => {
    const detail = read("src/components/bank/TigerPayTransactionDetail.tsx");
    expect(detail).toContain("/events");
    expect(detail).toContain("Current transaction state");
    expect(detail).toContain("last_event_id");
  });

  it("opens detail from the existing dialog interface", () => {
    const tab = read("src/components/bank/TigerPayTab.tsx");
    expect(tab).toContain("TigerPayTransactionDetail");
    expect(tab).toContain("onRowClick");
  });
});

describe("Tiger Pay secret exposure guards", () => {
  it("does not include service-role key or Tiger Pay secret in client code", () => {
    const clientFiles = listFiles(path.join(ROOT, "src/components")).concat(
      listFiles(path.join(ROOT, "src/lib/supabase"))
    );
    const browserish = clientFiles.filter((file) =>
      /client\.tsx$|TigerPay|BankStatement/.test(file)
    );

    for (const file of browserish) {
      const content = fs.readFileSync(file, "utf8");
      expect(content).not.toMatch(/TIGER_PAY_CLIENT_SECRET/);
      expect(content).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
      expect(content).not.toMatch(/SUPABASE_SERVICE_KEY/);
    }

    expect(isNumericSearch("12345")).toBe(true);
    expect(isNumericSearch("pay-123")).toBe(false);
  });
});
