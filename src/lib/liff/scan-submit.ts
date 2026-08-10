/**
 * Guards against double-submit after a successful scan.
 * Pure logic so it can be unit-tested without camera/LIFF.
 */
export type ScanSubmitState =
  | { status: "idle" }
  | { status: "submitting"; barcode: string }
  | { status: "sent"; barcode: string }
  | { status: "error"; barcode: string; message: string };

export function canAcceptScan(
  state: ScanSubmitState,
  barcode: string
): boolean {
  if (!barcode.trim()) return false;
  if (state.status === "submitting" || state.status === "sent") return false;
  return true;
}

export function beginSubmit(
  state: ScanSubmitState,
  barcode: string
): ScanSubmitState | null {
  if (!canAcceptScan(state, barcode)) return null;
  return { status: "submitting", barcode };
}

export function markSent(barcode: string): ScanSubmitState {
  return { status: "sent", barcode };
}

export function markError(barcode: string, message: string): ScanSubmitState {
  return { status: "error", barcode, message };
}

export function resetSubmit(): ScanSubmitState {
  return { status: "idle" };
}
