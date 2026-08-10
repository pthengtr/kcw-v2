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

describe("createStableCodeGate", () => {
  it("confirms only after repeated identical hits", async () => {
    const { createStableCodeGate } = await import("@/lib/liff/barcode-scanner");
    const onConfirmed = vi.fn();
    const accept = createStableCodeGate(onConfirmed, 3);

    accept("16052911");
    accept("16052911");
    expect(onConfirmed).not.toHaveBeenCalled();
    accept("16052911");
    expect(onConfirmed).toHaveBeenCalledWith("16052911");
  });

  it("resets when the value changes or clears", async () => {
    const { createStableCodeGate } = await import("@/lib/liff/barcode-scanner");
    const onConfirmed = vi.fn();
    const accept = createStableCodeGate(onConfirmed, 3);

    accept("111");
    accept("222");
    accept("222");
    accept(null);
    accept("222");
    accept("222");
    expect(onConfirmed).not.toHaveBeenCalled();
    accept("222");
    expect(onConfirmed).toHaveBeenCalledWith("222");
  });
});

describe("pickBestDetectedCode", () => {
  it("prefers the larger centered barcode", async () => {
    const { pickBestDetectedCode } = await import("@/lib/liff/barcode-scanner");
    const code = pickBestDetectedCode(
      [
        {
          rawValue: "999",
          boundingBox: { x: 0, y: 0, width: 20, height: 10 },
        },
        {
          rawValue: "16052911",
          boundingBox: { x: 400, y: 200, width: 240, height: 60 },
        },
      ],
      1000,
      500
    );
    expect(code).toBe("16052911");
  });
});

describe("scan zoom helpers", () => {
  it("clamps logical zoom into 1–3", async () => {
    const { clampScanZoom, DEFAULT_SCAN_ZOOM } = await import(
      "@/lib/liff/barcode-scanner"
    );
    expect(clampScanZoom(DEFAULT_SCAN_ZOOM)).toBe(2);
    expect(clampScanZoom(0.2)).toBe(1);
    expect(clampScanZoom(9)).toBe(3);
  });

  it("applies track zoom when capability exists", async () => {
    const { preferTrackZoom } = await import("@/lib/liff/barcode-scanner");
    const applyConstraints = vi.fn(async () => undefined);
    const track = {
      getCapabilities: () => ({ zoom: { min: 1, max: 5, step: 0.1 } }),
      applyConstraints,
    } as unknown as MediaStreamTrack;
    const stream = {
      getVideoTracks: () => [track],
    } as unknown as MediaStream;

    await expect(preferTrackZoom(stream, 2)).resolves.toBe(2);
    expect(applyConstraints).toHaveBeenCalled();
  });

  it("returns null when zoom is unsupported", async () => {
    const { preferTrackZoom } = await import("@/lib/liff/barcode-scanner");
    const applyConstraints = vi.fn(async () => undefined);
    const track = {
      getCapabilities: () => ({}),
      applyConstraints,
    } as unknown as MediaStreamTrack;
    const stream = {
      getVideoTracks: () => [track],
    } as unknown as MediaStream;

    await expect(preferTrackZoom(stream, 2)).resolves.toBeNull();
    expect(applyConstraints).not.toHaveBeenCalled();
  });

  it("center-crops the video for digital zoom", async () => {
    const { drawCenterZoom } = await import("@/lib/liff/barcode-scanner");
    const drawImage = vi.fn();
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
    } as unknown as HTMLCanvasElement;
    const video = {
      videoWidth: 1000,
      videoHeight: 500,
    } as unknown as HTMLVideoElement;

    expect(drawCenterZoom(video, canvas, 2)).toBe(true);
    expect(canvas.width).toBe(500);
    expect(canvas.height).toBe(250);
    expect(drawImage).toHaveBeenCalledWith(
      video,
      250,
      125,
      500,
      250,
      0,
      0,
      500,
      250
    );
  });
});
