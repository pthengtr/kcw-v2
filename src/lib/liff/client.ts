import liff from "@line/liff";

import { getProductScannerLiffId } from "@/lib/liff/config";

export type LiffInitResult =
  | { ok: true; inClient: boolean; loggedIn: boolean }
  | { ok: false; error: string };

let initPromise: Promise<LiffInitResult> | null = null;

/**
 * Initialize LIFF once per page load.
 * Auth is LINE/LIFF identity only — no Supabase / kcw-v2 login.
 */
export async function initProductScannerLiff(): Promise<LiffInitResult> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const liffId = getProductScannerLiffId();
    if (!liffId) {
      return {
        ok: false as const,
        error:
          "ยังไม่ได้ตั้งค่า NEXT_PUBLIC_LINE_LIFF_PRODUCT_SCANNER_ID",
      };
    }

    try {
      await liff.init({ liffId });

      // Login only when needed (external browser / not yet authorized).
      // In LINE in-app LIFF this is usually already satisfied.
      if (!liff.isLoggedIn()) {
        // Avoid redirect loops outside LINE; caller shows "open from chat".
        if (liff.isInClient()) {
          liff.login();
          return {
            ok: false as const,
            error: "กำลังเข้าสู่ระบบ LINE…",
          };
        }
      }

      return {
        ok: true as const,
        inClient: liff.isInClient(),
        loggedIn: liff.isLoggedIn(),
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "LIFF initialization failed";
      return { ok: false as const, error: message };
    }
  })();

  return initPromise;
}

/** Reset cached init (tests / hot reload). */
export function resetProductScannerLiffInit(): void {
  initPromise = null;
}

export function canSendChatMessage(): boolean {
  try {
    return Boolean(liff.isInClient() && liff.isLoggedIn());
  } catch {
    return false;
  }
}

export async function sendTextToChat(text: string): Promise<void> {
  if (!canSendChatMessage()) {
    throw new Error(
      "ส่งกลับแชทได้เฉพาะเมื่อเปิดจาก LINE เท่านั้น (ไม่ใช้ Push API)"
    );
  }
  await liff.sendMessages([{ type: "text", text }]);
}

export function closeLiffWindow(): void {
  try {
    if (liff.isInClient()) {
      liff.closeWindow();
    }
  } catch {
    // ignore — UI can show a manual "กลับ LINE" state
  }
}

export { liff };
