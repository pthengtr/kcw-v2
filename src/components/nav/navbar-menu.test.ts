import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  EXPENSE_DROPDOWN_AFTER_INDEX,
  isExpenseActive,
  isNavActive,
  primaryNavLinks,
} from "@/components/nav/nav-config";

const ROOT = process.cwd();

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

describe("Navbar menu order and design", () => {
  it("orders primary links as home → reminder → party → BI with expense after reminder", () => {
    expect(primaryNavLinks.map((link) => link.href)).toEqual([
      "/home",
      "/reminder",
      "/party",
      "/bi/income",
    ]);
    expect(EXPENSE_DROPDOWN_AFTER_INDEX).toBe(1);
  });

  it("marks nested BI and expense routes as active", () => {
    const bi = primaryNavLinks.find((link) => link.href === "/bi/income");
    expect(bi).toBeTruthy();
    expect(isNavActive("/bi/sales", bi!)).toBe(true);
    expect(isNavActive("/party", bi!)).toBe(false);
    expect(isExpenseActive("/expense/general")).toBe(true);
    expect(isExpenseActive("/reminder")).toBe(false);
  });

  it("uses a sticky logo-only navbar and a simple mobile sheet", () => {
    const navbar = read("src/components/nav/NavbarClient.tsx");
    expect(navbar).toContain("sticky top-0");
    expect(navbar).toContain('href="/home"');
    expect(navbar).toContain("/kcw-logo.png");
    expect(navbar).toContain("md:hidden");
    expect(navbar).toContain("SheetContent");
    expect(navbar).toContain('aria-label="เปิดเมนู"');
    expect(navbar).toContain("<SheetTitle");
    expect(navbar).toContain("เมนู");
    // Logo already carries the brand; avoid redundant KCW text next to it.
    expect(navbar).not.toContain(">KCW</");
    expect(navbar).not.toContain("ระบบงานภายใน");
    expect(navbar).not.toContain("backdrop-blur");
  });
});

describe("Shared back navigation", () => {
  it("provides a shared BackButton used across app pages", () => {
    const back = read("src/components/common/BackButton.tsx");
    expect(back).toContain('label = "กลับ"');
    expect(back).toContain("ArrowBigLeftDash");

    const pages = [
      "src/components/expense/ExpensePageHeader.tsx",
      "src/components/expense/general/ExpenseGeneralPage.tsx",
      "src/components/expense/item/ExpenseItemPage.tsx",
      "src/components/bank/BankStatementSyncPage.tsx",
      "src/components/bank/TigerPayPage.tsx",
      "src/components/po/PoStatusPage.tsx",
      "src/components/rbac/RbacAdminPage.tsx",
      "src/components/party/PartyScreen.tsx",
      "src/components/reminder/ReminderTable.tsx",
      "src/components/bi/BiShell.tsx",
      "src/components/product-related/ProductRelatedScreen.tsx",
      "src/app/(root)/kb/_components/kb-admin-screen.tsx",
      "src/app/(root)/product-images/_components/product-image-admin-screen.tsx",
      "src/app/(root)/(user)/user/page.tsx",
      "src/app/(root)/(expense)/expense/page.tsx",
      "src/app/(root)/(expense)/expense/company/page.tsx",
      "src/app/(root)/(expense)/expense/company/[branch]/page.tsx",
    ];

    for (const rel of pages) {
      expect(read(rel)).toContain("BackButton");
    }
  });
});
