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
  it("orders primary links as reminder → party → BI with expense inserted after reminder", () => {
    expect(primaryNavLinks.map((link) => link.href)).toEqual([
      "/reminder",
      "/party",
      "/bi/income",
    ]);
    expect(EXPENSE_DROPDOWN_AFTER_INDEX).toBe(0);
  });

  it("marks nested BI and expense routes as active", () => {
    const bi = primaryNavLinks.find((link) => link.href === "/bi/income");
    expect(bi).toBeTruthy();
    expect(isNavActive("/bi/sales", bi!)).toBe(true);
    expect(isNavActive("/party", bi!)).toBe(false);
    expect(isExpenseActive("/expense/general")).toBe(true);
    expect(isExpenseActive("/reminder")).toBe(false);
  });

  it("uses a sticky branded navbar with logo home link and mobile sheet", () => {
    const navbar = read("src/components/nav/NavbarClient.tsx");
    expect(navbar).toContain("sticky top-0");
    expect(navbar).toContain('href="/home"');
    expect(navbar).toContain("/kcw-logo.png");
    expect(navbar).toContain("md:hidden");
    expect(navbar).toContain("SheetContent");
    expect(navbar).toContain('aria-label="เปิดเมนู"');
    expect(navbar).not.toContain('label: "หน้าแรก"');
  });
});
