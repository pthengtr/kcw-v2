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

  it("keeps image carousel controls usable on narrow screens", () => {
    const carousel = read("src/components/common/CommonImageCaroussel.tsx");
    expect(carousel).toContain('CarouselPrevious className="left-2');
    expect(carousel).toContain('CarouselNext className="right-2');
    expect(carousel).toContain("w-[calc(100vw-1rem)]");

    const manager = read("src/components/common/CommonImageManagerDialog.tsx");
    expect(manager).toContain("w-[calc(100vw-1rem)]");
    expect(manager).toContain("h-[90dvh]");
  });

  it("keeps create/edit controls fluid under md without changing desktop widths", () => {
    const datePicker = read("src/components/common/DatePickerInput.tsx");
    expect(datePicker).toContain("w-full min-w-0 pl-3 text-left font-normal sm:w-[240px]");
    expect(datePicker).toContain("flex flex-col gap-2 min-w-0 sm:flex-row");

    const party = read("src/components/common/PartySelect.tsx");
    expect(party).toContain("w-[min(480px,calc(100vw-2rem))]");

    const bank = read("src/components/common/BankAccountPicker.tsx");
    expect(bank).toContain("w-[min(520px,calc(100vw-2rem))]");

    const form = read("src/components/reminder/PaymentReminderForm.tsx");
    expect(form).toContain("grid-cols-1 sm:grid-cols-2 md:grid-cols-4");

    const dialog = read("src/components/reminder/ReminderFormDialog.tsx");
    expect(dialog).toContain("overflow-x-hidden");
  });
});
