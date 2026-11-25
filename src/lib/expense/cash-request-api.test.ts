import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "../..");

function readSrc(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("expense cash request access split", () => {
  it("exports a viewer gate separate from admin", () => {
    const api = readSrc("lib/expense/cash-request-api.ts");
    expect(api).toContain("export async function requireExpenseCashViewer");
    expect(api).toContain("export async function requireExpenseCashAdmin");
    expect(api).toContain("isAdmin");
  });

  it("allows staff to list/get and mark accounting; keeps approve admin-only", () => {
    const list = readSrc("app/api/expense/cash-requests/route.ts");
    const byId = readSrc("app/api/expense/cash-requests/[id]/route.ts");
    const accounting = readSrc(
      "app/api/expense/cash-requests/accounting/route.ts"
    );

    expect(list).toContain("requireExpenseCashViewer");
    expect(list).not.toContain("requireExpenseCashAdmin");

    expect(byId).toMatch(/export async function GET[\s\S]*requireExpenseCashViewer/);
    expect(byId).toMatch(
      /export async function POST[\s\S]*requireExpenseCashAdmin/
    );

    expect(accounting).toContain("requireExpenseCashViewer");
    expect(accounting).not.toContain("requireExpenseCashAdmin");
    expect(accounting).toContain("auth.admin");
  });

  it("passes canManage and canUpdateAccounting into the client UI", () => {
    const page = readSrc(
      "app/(root)/(expense)/expense/cash-requests/page.tsx"
    );
    const ui = readSrc(
      "components/expense/cash-requests/ExpenseCashRequestsPage.tsx"
    );
    expect(page).toContain("ROLE_ADMIN");
    expect(page).toContain("canManage");
    expect(page).toContain("canUpdateAccounting");
    expect(ui).toContain("canManage");
    expect(ui).toContain("canUpdateAccounting");
    expect(ui).toContain("canUpdateAccounting &&");
  });
});
