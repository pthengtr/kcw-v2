import { describe, expect, it, vi } from "vitest";

import { sanitizeBarcode } from "@/lib/liff/product-scan-contract";

describe("sanitizeBarcode used by scanner", () => {
  it("accepts typical product codes", () => {
    expect(sanitizeBarcode("22010585")).toBe("22010585");
    expect(sanitizeBarcode("8851234567890")).toBe("8851234567890");
    expect(sanitizeBarcode("*ABC123*")).toBe("ABC123");
  });
});

describe("preferContinuousAutofocus", () => {
  it("returns false when track has no focus capability", async () => {
    const { preferContinuousAutofocus } = await import(
      "@/lib/liff/barcode-scanner"
    );
    const track = {
      applyConstraints: vi.fn(),
    } as unknown as MediaStreamTrack;
    const stream = {
      getVideoTracks: () => [track],
    } as unknown as MediaStream;

    await expect(preferContinuousAutofocus(stream)).resolves.toBe(false);
    expect(track.applyConstraints).not.toHaveBeenCalled();
  });

  it("applies continuous focus when capability exists", async () => {
    const { preferContinuousAutofocus } = await import(
      "@/lib/liff/barcode-scanner"
    );
    const applyConstraints = vi.fn(async () => undefined);
    const track = {
      getCapabilities: () => ({ focusMode: ["continuous", "manual"] }),
      applyConstraints,
    } as unknown as MediaStreamTrack;
    const stream = {
      getVideoTracks: () => [track],
    } as unknown as MediaStream;

    await expect(preferContinuousAutofocus(stream)).resolves.toBe(true);
    expect(applyConstraints).toHaveBeenCalled();
  });

  it("falls back to single-shot when continuous is unavailable", async () => {
    const { preferContinuousAutofocus } = await import(
      "@/lib/liff/barcode-scanner"
    );
    const applyConstraints = vi.fn(async () => undefined);
    const track = {
      getCapabilities: () => ({ focusMode: ["single-shot", "manual"] }),
      applyConstraints,
    } as unknown as MediaStreamTrack;
    const stream = {
      getVideoTracks: () => [track],
    } as unknown as MediaStream;

    await expect(preferContinuousAutofocus(stream)).resolves.toBe(true);
    expect(applyConstraints).toHaveBeenCalledWith(
      expect.objectContaining({
        advanced: [expect.objectContaining({ focusMode: "single-shot" })],
      })
    );
  });
});

describe("triggerAutofocus", () => {
  it("applies pointsOfInterest when supported", async () => {
    const { triggerAutofocus } = await import("@/lib/liff/barcode-scanner");
    const applyConstraints = vi.fn(async () => undefined);
    const track = {
      getCapabilities: () => ({
        focusMode: ["continuous"],
        pointsOfInterest: true,
      }),
      applyConstraints,
    } as unknown as MediaStreamTrack;
    const stream = {
      getVideoTracks: () => [track],
    } as unknown as MediaStream;

    await expect(
      triggerAutofocus(stream, { x: 0.5, y: 0.4 })
    ).resolves.toBe(true);
    expect(applyConstraints).toHaveBeenCalled();
  });
});

describe("setTorchEnabled", () => {
  it("returns false without torch capability", async () => {
    const { setTorchEnabled } = await import("@/lib/liff/barcode-scanner");
    const applyConstraints = vi.fn(async () => undefined);
    const track = {
      getCapabilities: () => ({}),
      applyConstraints,
    } as unknown as MediaStreamTrack;
    const stream = {
      getVideoTracks: () => [track],
    } as unknown as MediaStream;

    await expect(setTorchEnabled(stream, true)).resolves.toBe(false);
    expect(applyConstraints).not.toHaveBeenCalled();
  });

  it("enables torch when supported", async () => {
    const { setTorchEnabled } = await import("@/lib/liff/barcode-scanner");
    const applyConstraints = vi.fn(async () => undefined);
    const track = {
      getCapabilities: () => ({ torch: true }),
      applyConstraints,
    } as unknown as MediaStreamTrack;
    const stream = {
      getVideoTracks: () => [track],
    } as unknown as MediaStream;

    await expect(setTorchEnabled(stream, true)).resolves.toBe(true);
    expect(applyConstraints).toHaveBeenCalled();
  });
});
