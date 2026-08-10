import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@line/liff", () => {
  const liff = {
    init: vi.fn(async () => undefined),
    isLoggedIn: vi.fn(() => true),
    isInClient: vi.fn(() => true),
    login: vi.fn(),
    sendMessages: vi.fn(async () => undefined),
    closeWindow: vi.fn(),
  };
  return { default: liff };
});

import liff from "@line/liff";

import {
  canSendChatMessage,
  initProductScannerLiff,
  resetProductScannerLiffInit,
  sendTextToChat,
} from "@/lib/liff/client";

describe("liff client helper", () => {
  afterEach(() => {
    resetProductScannerLiffInit();
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_LINE_LIFF_PRODUCT_SCANNER_ID;
  });

  it("fails when LIFF id env is missing", async () => {
    const result = await initProductScannerLiff();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("NEXT_PUBLIC_LINE_LIFF_PRODUCT_SCANNER_ID");
    }
    expect(liff.init).not.toHaveBeenCalled();
  });

  it("initializes with env LIFF id", async () => {
    process.env.NEXT_PUBLIC_LINE_LIFF_PRODUCT_SCANNER_ID = "123-abc";
    vi.mocked(liff.isInClient).mockReturnValue(true);
    vi.mocked(liff.isLoggedIn).mockReturnValue(true);

    const result = await initProductScannerLiff();
    expect(result).toEqual({ ok: true, inClient: true, loggedIn: true });
    expect(liff.init).toHaveBeenCalledWith({ liffId: "123-abc" });
  });

  it("blocks sendMessages outside LINE client", async () => {
    process.env.NEXT_PUBLIC_LINE_LIFF_PRODUCT_SCANNER_ID = "123-abc";
    vi.mocked(liff.isInClient).mockReturnValue(false);
    vi.mocked(liff.isLoggedIn).mockReturnValue(true);
    await initProductScannerLiff();

    expect(canSendChatMessage()).toBe(false);
    await expect(sendTextToChat("📦 สแกนสินค้า: 1")).rejects.toThrow(
      /เปิดจาก LINE/
    );
    expect(liff.sendMessages).not.toHaveBeenCalled();
  });
});
