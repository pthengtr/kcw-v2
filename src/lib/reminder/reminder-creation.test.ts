import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import {
  REMINDER_CREATION_DISABLED,
  REMINDER_CREATION_DISABLED_MESSAGE,
} from "@/lib/reminder/flags";

const ROOT = process.cwd();

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

describe("Reminder creation retirement", () => {
  it("keeps creation disabled until the local webapp takes over", () => {
    expect(REMINDER_CREATION_DISABLED).toBe(true);
    expect(REMINDER_CREATION_DISABLED_MESSAGE).toContain("เว็บแอปในเครื่อง");
  });

  it("removes the create-reminder plus button from the list toolbar", () => {
    const table = read("src/components/reminder/ReminderTable.tsx");
    expect(table).not.toContain("ReminderFormDialog");
    expect(table).not.toMatch(/\bPlus\b/);
    expect(table).not.toContain("เพิ่มรายการเตือนโอน");
    expect(table).toContain("REMINDER_CREATION_DISABLED_MESSAGE");
    expect(table).toContain('data-testid="reminder-creation-retired"');
  });

  it("refuses create mode in the form dialog and insert path", () => {
    const dialog = read("src/components/reminder/ReminderFormDialog.tsx");
    expect(dialog).toContain('mode="edit"');
    expect(dialog).not.toContain('mode: "create"');
    expect(dialog).toContain("REMINDER_CREATION_DISABLED_MESSAGE");

    const form = read("src/components/reminder/PaymentReminderForm.tsx");
    expect(form).toContain("REMINDER_CREATION_DISABLED");
    expect(form).toContain("throw new Error(REMINDER_CREATION_DISABLED_MESSAGE)");
    expect(form).toContain("บันทึกการแก้ไข");
  });

  it("still lets users edit existing reminders from the detail pane", () => {
    const detail = read("src/components/reminder/ReminderDetail.tsx");
    expect(detail).toContain("ReminderFormDialog");
    expect(detail).toContain("update");
    expect(detail).toContain("แก้ไขรายการเตือนโอน");
  });
});
