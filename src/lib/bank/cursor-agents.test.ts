import { describe, expect, it } from "vitest";

import { isCursorRunTerminal } from "@/lib/bank/cursor-agents";

describe("cursor agent run status", () => {
  it("treats finished and failed runs as terminal", () => {
    expect(isCursorRunTerminal("FINISHED")).toBe(true);
    expect(isCursorRunTerminal("ERROR")).toBe(true);
    expect(isCursorRunTerminal("CANCELLED")).toBe(true);
    expect(isCursorRunTerminal("EXPIRED")).toBe(true);
  });

  it("treats creating and running as non-terminal", () => {
    expect(isCursorRunTerminal("CREATING")).toBe(false);
    expect(isCursorRunTerminal("RUNNING")).toBe(false);
  });
});
