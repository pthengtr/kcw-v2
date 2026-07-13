import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

describe("Reminder mobile layout", () => {
  it("renders a mobile card list instead of forcing wide table scrolling", () => {
    const table = read("src/components/reminder/ReminderTable.tsx");
    expect(table).toContain("md:hidden");
    expect(table).toContain("MobileReminderCard");
    expect(table).toContain("hidden md:block");
  });

  it("uses a responsive detail sheet on the reminder page", () => {
    const page = read("src/app/(root)/(reminder)/reminder/page.tsx");
    expect(page).toContain("w-screen");
    expect(page).toContain("md:min-w-[80vw]");
  });

  it("keeps the sheet close button above sticky detail content", () => {
    const sheet = read("src/components/ui/sheet.tsx");
    expect(sheet).toContain("SheetPrimitive.Close");
    expect(sheet).toMatch(/SheetPrimitive\.Close[^>]*z-50/);

    const detail = read("src/components/reminder/ReminderDetail.tsx");
    expect(detail).toContain("pr-10");
  });
});
