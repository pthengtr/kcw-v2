import { describe, expect, it } from "vitest";

import {
  isCursorRunTerminal,
  resolveCursorAgentModel,
} from "@/lib/bank/cursor-agents";

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

describe("resolveCursorAgentModel", () => {
  it("defaults to Cursor Router auto-smart balanced", () => {
    expect(
      resolveCursorAgentModel({ modelId: null, optimizeFor: null })
    ).toEqual({
      id: "auto-smart",
      params: [{ id: "optimize_for", value: "balanced" }],
    });
  });

  it("supports plain auto fallback", () => {
    expect(resolveCursorAgentModel({ modelId: "auto" })).toEqual({
      id: "auto",
    });
  });

  it("omits model for default/omit", () => {
    expect(resolveCursorAgentModel({ modelId: "omit" })).toBeUndefined();
    expect(resolveCursorAgentModel({ modelId: "default" })).toBeUndefined();
  });

  it("passes through explicit model ids", () => {
    expect(resolveCursorAgentModel({ modelId: "gpt-5.4-high" })).toEqual({
      id: "gpt-5.4-high",
    });
  });

  it("accepts router optimize_for overrides", () => {
    expect(
      resolveCursorAgentModel({
        modelId: "auto-smart",
        optimizeFor: "intelligence",
      })
    ).toEqual({
      id: "auto-smart",
      params: [{ id: "optimize_for", value: "intelligence" }],
    });
  });
});
