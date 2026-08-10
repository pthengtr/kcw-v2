/**
 * Camera barcode scanning for LIFF.
 * Prefers native BarcodeDetector (fast 1D on Android); falls back to html5-qrcode.
 * Opens the camera once — never call getCameras() first (that double-prompts).
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
  Html5QrcodeSupportedFormats.QR_CODE,
];

type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorCtor = {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
};

export type BarcodeScannerHandle = {
  stop: () => Promise<void>;
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

function buildWideQrBox(viewW: number, viewH: number) {
  const width = Math.max(260, Math.floor(viewW * 0.92));
  const height = Math.max(110, Math.min(Math.floor(viewH * 0.34), 160));
  return { width, height };
}

async function startNativeScanner(
  container: HTMLElement,
  onDetected: (code: string) => void
): Promise<BarcodeScannerHandle> {
  const Ctor = (globalThis as unknown as { BarcodeDetector: BarcodeDetectorCtor })
    .BarcodeDetector;
  const detector = new Ctor({ formats: [...NATIVE_FORMATS] });

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

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
  });
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
      }, 70);
    }
  };

  void tick();

  return {
    stop: async () => {
      stopped = true;
      if (timer != null) window.clearTimeout(timer);
      stopMediaStream(stream);
      video.srcObject = null;
      container.replaceChildren();
    },
  };
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
    useBarCodeDetectorIfSupported: true,
  });

  await scanner.start(
    { facingMode: "environment" },
    {
      fps: 15,
      qrbox: buildWideQrBox,
      disableFlip: true,
      videoConstraints: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    },
    (decoded) => {
      const code = sanitizeBarcode(decoded);
      if (code) onDetected(code);
    },
    () => {
      // ignore per-frame misses
    }
  );

  return {
    stop: async () => {
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
  };
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
