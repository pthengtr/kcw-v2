/**
 * Camera barcode scanning for LIFF.
 * Prefers native BarcodeDetector (fast 1D on Android); falls back to html5-qrcode.
 * Opens the camera once — never call getCameras() first (that double-prompts).
 *
 * Permission "Always allow" cannot be forced from web/LIFF — the OS/LINE WebView owns that.
 * Autofocus is best-effort: continuous when supported, plus tap-to-focus / periodic nudge.
 *
 * Do NOT put focusMode in the initial getUserMedia constraints — some LINE/iOS WebViews
 * reject or mis-handle unknown constraint keys and fail to open the camera cleanly.
 */

import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

import { sanitizeBarcode } from "@/lib/liff/product-scan-contract";

const NATIVE_FORMATS = [
  "code_128",
  "code_39",
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "itf",
  "codabar",
  "qr_code",
] as const;

/** Keep format list tight — more formats = slower ZXing fallback. */
const ZXING_FORMATS = [
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.QR_CODE,
];

/**
 * 720p is the practical sweet spot for 1D in WebViews:
 * enough detail for EAN/Code128, less AF hunting / motion blur than 1080p.
 */
const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: { ideal: "environment" },
  width: { ideal: 1280 },
  height: { ideal: 720 },
  aspectRatio: { ideal: 16 / 9 },
};

type BarcodeDetectorLike = {
  detect: (
    source: HTMLVideoElement | ImageBitmap | HTMLCanvasElement
  ) => Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorCtor = {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
};

type FocusCapableTrack = MediaStreamTrack & {
  getCapabilities?: () => MediaTrackCapabilities;
};

type FocusCapabilities = MediaTrackCapabilities & {
  focusMode?: string[];
  torch?: boolean;
  pointsOfInterest?: boolean;
};

type FocusConstraintSet = MediaTrackConstraintSet & {
  focusMode?: string;
  torch?: boolean;
  pointsOfInterest?: Array<{ x: number; y: number }>;
};

export type BarcodeScannerHandle = {
  stop: () => Promise<void>;
  /** Best-effort tap / button refocus. Returns true if a focus constraint was applied. */
  refocus: (point?: { x: number; y: number }) => Promise<boolean>;
  /** Toggle torch when the track supports it. */
  setTorch: (on: boolean) => Promise<boolean>;
  /** Whether torch appears available (capability probe after start). */
  torchSupported: boolean;
};

function stopMediaStream(stream: MediaStream | null) {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      // ignore
    }
  }
}

function getFocusTrack(stream: MediaStream | null): FocusCapableTrack | null {
  const track = stream?.getVideoTracks()?.[0] as FocusCapableTrack | undefined;
  return track ?? null;
}

function readFocusCaps(track: FocusCapableTrack): FocusCapabilities {
  try {
    return (track.getCapabilities?.() ?? {}) as FocusCapabilities;
  } catch {
    return {};
  }
}

async function applyFocusConstraint(
  track: FocusCapableTrack,
  constraint: FocusConstraintSet
): Promise<boolean> {
  if (!track.applyConstraints) return false;
  try {
    await track.applyConstraints({
      advanced: [constraint as MediaTrackConstraintSet],
    });
    return true;
  } catch {
    try {
      await track.applyConstraints(constraint as MediaTrackConstraintSet);
      return true;
    } catch {
      return false;
    }
  }
}

/** Best-effort continuous autofocus after the stream is open. */
export async function preferContinuousAutofocus(
  stream: MediaStream
): Promise<boolean> {
  const track = getFocusTrack(stream);
  if (!track) return false;

  const caps = readFocusCaps(track);
  const modes = caps.focusMode ?? [];

  if (modes.includes("continuous")) {
    if (await applyFocusConstraint(track, { focusMode: "continuous" })) {
      return true;
    }
  }

  // Some Android WebViews only expose single-shot; fire once at start.
  if (modes.includes("single-shot")) {
    return applyFocusConstraint(track, { focusMode: "single-shot" });
  }

  return false;
}

/**
 * Tap-to-focus / manual refocus.
 * Uses pointsOfInterest when available; otherwise re-triggers continuous/single-shot.
 */
export async function triggerAutofocus(
  stream: MediaStream,
  point?: { x: number; y: number }
): Promise<boolean> {
  const track = getFocusTrack(stream);
  if (!track) return false;

  const caps = readFocusCaps(track);
  const modes = caps.focusMode ?? [];
  let applied = false;

  if (
    point &&
    caps.pointsOfInterest &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y)
  ) {
    const x = Math.min(1, Math.max(0, point.x));
    const y = Math.min(1, Math.max(0, point.y));
    applied =
      (await applyFocusConstraint(track, {
        pointsOfInterest: [{ x, y }],
      })) || applied;
  }

  if (modes.includes("single-shot")) {
    applied =
      (await applyFocusConstraint(track, { focusMode: "single-shot" })) ||
      applied;
  } else if (modes.includes("continuous")) {
    applied =
      (await applyFocusConstraint(track, { focusMode: "continuous" })) ||
      applied;
  }

  return applied;
}

export async function setTorchEnabled(
  stream: MediaStream,
  on: boolean
): Promise<boolean> {
  const track = getFocusTrack(stream);
  if (!track) return false;
  const caps = readFocusCaps(track);
  if (!caps.torch) return false;
  return applyFocusConstraint(track, { torch: on });
}

export function isTorchSupported(stream: MediaStream | null): boolean {
  const track = getFocusTrack(stream);
  if (!track) return false;
  return Boolean(readFocusCaps(track).torch);
}

async function canUseNativeDetector(): Promise<boolean> {
  const Ctor = (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
    .BarcodeDetector;
  if (typeof Ctor !== "function") return false;
  try {
    if (typeof Ctor.getSupportedFormats === "function") {
      const supported = await Ctor.getSupportedFormats();
      return (
        supported.includes("code_128") ||
        supported.includes("ean_13") ||
        supported.includes("code_39")
      );
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Wide horizontal band for 1D barcodes.
 * Previous 160px height cap was too shallow for soft-focus / distant EAN labels.
 */
function buildWideQrBox(viewW: number, viewH: number) {
  const width = Math.max(280, Math.floor(viewW * 0.94));
  const height = Math.max(180, Math.min(Math.floor(viewH * 0.45), 280));
  return { width, height };
}

function attachVideoEl(container: HTMLElement): HTMLVideoElement {
  container.replaceChildren();
  const video = document.createElement("video");
  video.setAttribute("playsinline", "true");
  video.setAttribute("muted", "true");
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.style.width = "100%";
  video.style.height = "100%";
  video.style.objectFit = "cover";
  container.appendChild(video);
  return video;
}

function makeHandle(opts: {
  stream: MediaStream | null;
  torchSupported: boolean;
  stop: () => Promise<void>;
}): BarcodeScannerHandle {
  return {
    torchSupported: opts.torchSupported,
    stop: opts.stop,
    refocus: async (point) => {
      if (!opts.stream) return false;
      return triggerAutofocus(opts.stream, point);
    },
    setTorch: async (on) => {
      if (!opts.stream) return false;
      return setTorchEnabled(opts.stream, on);
    },
  };
}

async function startNativeScanner(
  container: HTMLElement,
  onDetected: (code: string) => void
): Promise<BarcodeScannerHandle> {
  const Ctor = (globalThis as unknown as { BarcodeDetector: BarcodeDetectorCtor })
    .BarcodeDetector;
  const detector = new Ctor({ formats: [...NATIVE_FORMATS] });

  const video = attachVideoEl(container);

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: VIDEO_CONSTRAINTS,
  });
  await preferContinuousAutofocus(stream);
  video.srcObject = stream;
  await video.play();

  let stopped = false;
  let timer: number | undefined;
  let handling = false;

  const tick = async () => {
    if (stopped || handling) return;
    try {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const codes = await detector.detect(video);
        const raw = codes.find((c) => c.rawValue)?.rawValue;
        const code = sanitizeBarcode(raw ?? null);
        if (code) {
          handling = true;
          onDetected(code);
          return;
        }
      }
    } catch {
      // transient detect errors — keep looping
    }
    if (!stopped) {
      timer = window.setTimeout(() => {
        void tick();
      }, 50);
    }
  };

  // WebViews that lock focus after open often need a periodic nudge.
  const focusTimer = window.setInterval(() => {
    if (stopped) return;
    void triggerAutofocus(stream);
  }, 2500);

  void tick();

  return makeHandle({
    stream,
    torchSupported: isTorchSupported(stream),
    stop: async () => {
      stopped = true;
      if (timer != null) window.clearTimeout(timer);
      if (focusTimer != null) window.clearInterval(focusTimer);
      stopMediaStream(stream);
      video.srcObject = null;
      container.replaceChildren();
    },
  });
}

async function startHtml5QrcodeScanner(
  container: HTMLElement,
  onDetected: (code: string) => void
): Promise<BarcodeScannerHandle> {
  // html5-qrcode owns this element id; ensure a dedicated child host.
  container.replaceChildren();
  const host = document.createElement("div");
  host.id = `kcw-html5-qr-${Math.random().toString(36).slice(2, 9)}`;
  host.style.width = "100%";
  host.style.minHeight = "320px";
  container.appendChild(host);

  const scanner = new Html5Qrcode(host.id, {
    formatsToSupport: ZXING_FORMATS,
    verbose: false,
    // Prefer this library's own pipeline when we already know native start failed
    // or is unavailable — avoids a second weak BarcodeDetector attempt.
    useBarCodeDetectorIfSupported: false,
  });

  // Pass constraints only via videoConstraints to avoid facingMode double-config.
  await scanner.start(
    VIDEO_CONSTRAINTS,
    {
      fps: 24,
      qrbox: buildWideQrBox,
      // 1D codes on printed labels are upright relative to the rear camera.
      disableFlip: true,
      aspectRatio: 16 / 9,
      videoConstraints: VIDEO_CONSTRAINTS,
    },
    (decoded) => {
      const code = sanitizeBarcode(decoded);
      if (code) onDetected(code);
    },
    () => {
      // ignore per-frame misses
    }
  );

  let stream: MediaStream | null = null;
  try {
    const video = host.querySelector("video");
    const src = video?.srcObject;
    if (src instanceof MediaStream) {
      stream = src;
      await preferContinuousAutofocus(stream);
    }
  } catch {
    // ignore
  }

  let focusTimer: number | undefined;
  if (stream) {
    focusTimer = window.setInterval(() => {
      if (!stream) return;
      void triggerAutofocus(stream);
    }, 2500);
  }

  return makeHandle({
    stream,
    torchSupported: isTorchSupported(stream),
    stop: async () => {
      if (focusTimer != null) window.clearInterval(focusTimer);
      try {
        if (scanner.isScanning) await scanner.stop();
      } catch {
        // ignore
      }
      try {
        scanner.clear();
      } catch {
        // ignore
      }
      container.replaceChildren();
    },
  });
}

/**
 * Start scanning inside `container`. Resolves when camera is running.
 * Calls `onDetected` at most until the caller stops the handle.
 */
export async function startProductBarcodeScanner(
  container: HTMLElement,
  onDetected: (code: string) => void
): Promise<BarcodeScannerHandle> {
  if (!navigator?.mediaDevices?.getUserMedia) {
    throw new Error("เบราว์เซอร์นี้ไม่รองรับกล้อง");
  }

  if (await canUseNativeDetector()) {
    try {
      return await startNativeScanner(container, onDetected);
    } catch {
      // Fall through to ZXing-based scanner.
    }
  }

  return startHtml5QrcodeScanner(container, onDetected);
}
