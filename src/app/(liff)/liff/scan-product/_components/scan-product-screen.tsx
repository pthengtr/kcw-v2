"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Camera, CheckCircle2, RotateCcw, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  canSendChatMessage,
  closeLiffWindow,
  initProductScannerLiff,
  sendTextToChat,
  type LiffInitResult,
} from "@/lib/liff/client";
import {
  formatProductScanCallback,
  sanitizeBarcode,
} from "@/lib/liff/product-scan-contract";
import {
  beginSubmit,
  markError,
  markSent,
  resetSubmit,
  type ScanSubmitState,
} from "@/lib/liff/scan-submit";
import { cn } from "@/lib/utils";

const SCANNER_ELEMENT_ID = "kcw-liff-product-scanner";

/** Prefer common retail + industrial 1D formats; QR as secondary. */
const FORMATS = [
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
];

type UiPhase =
  | "boot"
  | "ready"
  | "scanning"
  | "permission"
  | "unsupported"
  | "outside_line"
  | "liff_error";

function buildQrBox(viewW: number, viewH: number) {
  const width = Math.max(240, Math.floor(viewW * 0.88));
  // Wide short box works much better for 1D barcodes than a square.
  const height = Math.max(90, Math.min(Math.floor(viewH * 0.28), 140));
  return { width, height };
}

export default function ScanProductScreen() {
  const [liffState, setLiffState] = useState<LiffInitResult | null>(null);
  const [phase, setPhase] = useState<UiPhase>("boot");
  const [detected, setDetected] = useState<string | null>(null);
  const [submit, setSubmit] = useState<ScanSubmitState>({ status: "idle" });
  const [cameraError, setCameraError] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const startingRef = useRef(false);
  const aliveRef = useRef(true);
  const submitRef = useRef(submit);
  const handleDecodedRef = useRef<(code: string) => void>(() => {});

  submitRef.current = submit;

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
    } catch {
      // already stopped
    }
    try {
      scanner.clear();
    } catch {
      // ignore
    }
  }, []);

  const handleDecoded = useCallback(
    async (barcode: string) => {
      const next = beginSubmit(submitRef.current, barcode);
      if (!next) return;

      setDetected(barcode);
      setSubmit(next);
      await stopScanner();
      if (!aliveRef.current) return;
      setPhase("ready");

      if (!canSendChatMessage()) {
        setSubmit(
          markError(
            barcode,
            "สแกนได้แล้ว แต่ส่งกลับแชทได้เฉพาะเมื่อเปิดจาก LINE เท่านั้น"
          )
        );
        setPhase("outside_line");
        return;
      }

      try {
        const text = formatProductScanCallback(barcode);
        await sendTextToChat(text);
        if (!aliveRef.current) return;
        setSubmit(markSent(barcode));
        window.setTimeout(() => closeLiffWindow(), 400);
      } catch (err) {
        if (!aliveRef.current) return;
        const message =
          err instanceof Error ? err.message : "ส่งข้อความกลับ LINE ไม่สำเร็จ";
        setSubmit(markError(barcode, message));
      }
    },
    [stopScanner]
  );

  handleDecodedRef.current = (code: string) => {
    void handleDecoded(code);
  };

  const startScanner = useCallback(async () => {
    if (startingRef.current || !aliveRef.current) return;
    startingRef.current = true;
    setCameraError(null);
    setDetected(null);
    setSubmit(resetSubmit());

    try {
      await stopScanner();
      if (!aliveRef.current) return;

      if (
        typeof window === "undefined" ||
        !navigator?.mediaDevices?.getUserMedia
      ) {
        setPhase("unsupported");
        setCameraError("เบราว์เซอร์นี้ไม่รองรับกล้อง");
        return;
      }

      // Wait a tick so the scanner host has layout size (important in LIFF).
      await new Promise((r) => window.setTimeout(r, 50));
      const host = document.getElementById(SCANNER_ELEMENT_ID);
      if (!host) {
        setPhase("unsupported");
        setCameraError("ไม่พบพื้นที่กล้องบนหน้าจอ");
        return;
      }

      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, {
        formatsToSupport: FORMATS,
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      });
      scannerRef.current = scanner;

      const cameras = await Html5Qrcode.getCameras().catch(() => []);
      const rear = cameras.find((c) =>
        /back|rear|environment|หลัง|world/i.test(c.label || "")
      );
      const cameraConfig = rear?.id
        ? rear.id
        : { facingMode: "environment" as const };

      await scanner.start(
        cameraConfig,
        {
          fps: 12,
          qrbox: buildQrBox,
          // Avoid aspectRatio — it often crops badly in LINE WebView.
          disableFlip: false,
        },
        (decoded) => {
          const code = sanitizeBarcode(decoded);
          if (!code) return;
          handleDecodedRef.current(code);
        },
        () => {
          // frame miss — ignore
        }
      );

      if (!aliveRef.current) {
        await stopScanner();
        return;
      }
      setPhase("scanning");
    } catch (err) {
      if (!aliveRef.current) return;
      const message = err instanceof Error ? err.message : String(err);
      const denied = /NotAllowedError|Permission|denied|NotReadableError/i.test(
        message
      );
      if (denied) {
        setPhase("permission");
        setCameraError(
          "ไม่ได้รับอนุญาตใช้กล้อง กรุณาเปิดสิทธิ์กล้องแล้วลองใหม่"
        );
      } else if (/NotFoundError|no camera|DevicesNotFound/i.test(message)) {
        setPhase("unsupported");
        setCameraError("ไม่พบกล้องบนอุปกรณ์นี้");
      } else {
        setPhase("unsupported");
        setCameraError(message || "เปิดกล้องไม่สำเร็จ");
      }
    } finally {
      startingRef.current = false;
    }
  }, [stopScanner]);

  useEffect(() => {
    aliveRef.current = true;
    let cancelled = false;

    (async () => {
      const result = await initProductScannerLiff();
      if (cancelled || !aliveRef.current) return;
      setLiffState(result);

      if (!result.ok) {
        setPhase("liff_error");
        return;
      }

      if (!result.inClient) {
        setPhase("outside_line");
      } else {
        setPhase("ready");
      }
      await startScanner();
    })();

    return () => {
      cancelled = true;
      aliveRef.current = false;
      void stopScanner();
    };
    // Intentionally once on mount — startScanner/stopScanner are stable enough via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = () => {
    setDetected(null);
    setSubmit(resetSubmit());
    void startScanner();
  };

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-zinc-950 text-zinc-50">
      <header className="px-4 pb-2 pt-5">
        <h1 className="text-xl font-bold tracking-tight">สแกนสินค้า</h1>
        <p className="mt-1 text-sm text-zinc-400">
          จัดบาร์โค้ดให้อยู่ในกรอบแนวนอน แล้วรอระบบอ่านอัตโนมัติ
        </p>
      </header>

      <main className="flex flex-1 flex-col gap-4 px-4 pb-6">
        <div className="relative overflow-hidden rounded-xl bg-black">
          <div
            id={SCANNER_ELEMENT_ID}
            className="min-h-[320px] w-full overflow-hidden [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
          />
          {phase === "scanning" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-[26%] w-[86%] rounded-md border-2 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.28)]" />
            </div>
          )}
          {phase === "boot" && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400">
              กำลังเตรียมกล้อง…
            </div>
          )}
        </div>

        <StatusPanel
          phase={phase}
          liffState={liffState}
          detected={detected}
          submit={submit}
          cameraError={cameraError}
        />

        <div className="mt-auto flex flex-col gap-2">
          {(phase === "permission" ||
            phase === "unsupported" ||
            phase === "ready" ||
            phase === "outside_line" ||
            phase === "scanning" ||
            submit.status === "error") && (
            <Button type="button" className="h-11 w-full" onClick={handleRetry}>
              <RotateCcw className="size-4" />
              สแกนใหม่
            </Button>
          )}

          {submit.status === "sent" && (
            <Button
              type="button"
              variant="secondary"
              className="h-11 w-full"
              onClick={() => closeLiffWindow()}
            >
              กลับไปที่ LINE
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}

function StatusPanel({
  phase,
  liffState,
  detected,
  submit,
  cameraError,
}: {
  phase: UiPhase;
  liffState: LiffInitResult | null;
  detected: string | null;
  submit: ScanSubmitState;
  cameraError: string | null;
}) {
  if (phase === "liff_error") {
    return (
      <Alert tone="error" title="เปิด LIFF ไม่สำเร็จ">
        {liffState && !liffState.ok ? liffState.error : "เกิดข้อผิดพลาด"}
      </Alert>
    );
  }

  if (phase === "permission") {
    return (
      <Alert tone="error" title="ต้องการสิทธิ์กล้อง">
        {cameraError || "กรุณาอนุญาตการใช้กล้องใน LINE แล้วกดสแกนใหม่"}
      </Alert>
    );
  }

  if (phase === "unsupported") {
    return (
      <Alert tone="error" title="ใช้กล้องไม่ได้">
        {cameraError || "เบราว์เซอร์หรืออุปกรณ์นี้ไม่รองรับการสแกน"}
      </Alert>
    );
  }

  if (submit.status === "submitting") {
    return (
      <Alert tone="info" title="กำลังส่งกลับ LINE…">
        รหัส: {submit.barcode}
      </Alert>
    );
  }

  if (submit.status === "sent") {
    return (
      <Alert tone="success" title="ส่งรหัสกลับไปที่ LINE แล้ว">
        รหัส: {submit.barcode}
        <br />
        รอคำตอบจากบอทในแชทได้เลย
      </Alert>
    );
  }

  if (submit.status === "error") {
    return (
      <Alert tone="error" title="ส่งกลับ LINE ไม่สำเร็จ">
        {submit.message}
        {detected ? (
          <>
            <br />
            รหัสที่อ่านได้: {detected}
          </>
        ) : null}
      </Alert>
    );
  }

  if (phase === "outside_line") {
    return (
      <Alert tone="warn" title="เปิดนอก LINE">
        สแกนทดสอบได้ แต่ส่งผลกลับแชทบอทได้เฉพาะเมื่อเปิดจากปุ่มใน LINE
        (ไม่ใช้ Push API)
      </Alert>
    );
  }

  if (detected) {
    return (
      <Alert tone="info" title="ตรวจพบรหัส">
        {detected}
      </Alert>
    );
  }

  return (
    <Alert tone="info" title="พร้อมสแกน">
      <span className="inline-flex items-center gap-1.5">
        <Camera className="size-3.5" />
        รองรับบาร์โค้ดแนวยาว (Code 128 / EAN / UPC) และ QR
      </span>
    </Alert>
  );
}

function Alert({
  tone,
  title,
  children,
}: {
  tone: "info" | "success" | "error" | "warn";
  title: string;
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-700/60 bg-emerald-950/50 text-emerald-100"
      : tone === "error"
        ? "border-red-800/60 bg-red-950/40 text-red-100"
        : tone === "warn"
          ? "border-amber-700/60 bg-amber-950/40 text-amber-100"
          : "border-zinc-700 bg-zinc-900 text-zinc-200";

  const Icon =
    tone === "success" ? CheckCircle2 : tone === "error" ? XCircle : Camera;

  return (
    <div className={cn("rounded-lg border px-3 py-3 text-sm", toneClass)}>
      <div className="mb-1 flex items-center gap-1.5 font-medium">
        <Icon className="size-4 shrink-0" />
        {title}
      </div>
      <div className="text-[13px] leading-relaxed opacity-90">{children}</div>
    </div>
  );
}
