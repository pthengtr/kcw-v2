"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  Focus,
  Flashlight,
  FlashlightOff,
  Minus,
  Plus,
  RotateCcw,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DEFAULT_SCAN_ZOOM,
  SCAN_ZOOM_STEP,
  startProductBarcodeScanner,
  type BarcodeScannerHandle,
} from "@/lib/liff/barcode-scanner";
import {
  canSendChatMessage,
  closeLiffWindow,
  initProductScannerLiff,
  sendTextToChat,
  type LiffInitResult,
} from "@/lib/liff/client";
import { formatProductScanCallback } from "@/lib/liff/product-scan-contract";
import {
  beginSubmit,
  markError,
  markSent,
  resetSubmit,
  type ScanSubmitState,
} from "@/lib/liff/scan-submit";
import { cn } from "@/lib/utils";

type UiPhase =
  | "boot"
  | "ready"
  | "scanning"
  | "permission"
  | "unsupported"
  | "outside_line"
  | "liff_error";

export default function ScanProductScreen() {
  const [liffState, setLiffState] = useState<LiffInitResult | null>(null);
  const [phase, setPhase] = useState<UiPhase>("boot");
  const [detected, setDetected] = useState<string | null>(null);
  const [submit, setSubmit] = useState<ScanSubmitState>({ status: "idle" });
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [focusHint, setFocusHint] = useState(false);
  const [zoom, setZoom] = useState(DEFAULT_SCAN_ZOOM);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<BarcodeScannerHandle | null>(null);
  const startingRef = useRef(false);
  const aliveRef = useRef(true);
  const submitRef = useRef(submit);
  const onDetectedRef = useRef<(code: string) => void>(() => {});

  submitRef.current = submit;

  const stopScanner = useCallback(async () => {
    const handle = handleRef.current;
    handleRef.current = null;
    setTorchOn(false);
    setTorchSupported(false);
    setZoom(DEFAULT_SCAN_ZOOM);
    if (!handle) return;
    try {
      await handle.stop();
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

  onDetectedRef.current = (code: string) => {
    void handleDecoded(code);
  };

  const startScanner = useCallback(async () => {
    if (startingRef.current || !aliveRef.current) return;
    startingRef.current = true;
    setCameraError(null);
    setDetected(null);
    setSubmit(resetSubmit());
    setTorchOn(false);
    setTorchSupported(false);
    setZoom(DEFAULT_SCAN_ZOOM);

    try {
      await stopScanner();
      if (!aliveRef.current) return;

      // Let layout settle so the host has a real size in LIFF.
      await new Promise((r) => window.setTimeout(r, 40));
      const host = hostRef.current;
      if (!host) {
        setPhase("unsupported");
        setCameraError("ไม่พบพื้นที่กล้องบนหน้าจอ");
        return;
      }

      const handle = await startProductBarcodeScanner(host, (code) => {
        onDetectedRef.current(code);
      });
      if (!aliveRef.current) {
        await handle.stop();
        return;
      }
      handleRef.current = handle;
      setTorchSupported(handle.torchSupported);
      setZoom(handle.getZoom());
      setPhase("scanning");
      // Kick focus once after the preview has painted.
      window.setTimeout(() => {
        void handle.refocus();
      }, 350);
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
    // Mount once — avoid re-init restarting the camera / re-prompting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = () => {
    setDetected(null);
    setSubmit(resetSubmit());
    void startScanner();
  };

  const handleTapToFocus = async (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    if (phase !== "scanning") return;
    const handle = handleRef.current;
    const stage = stageRef.current;
    if (!handle || !stage) return;

    const rect = stage.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    setFocusHint(true);
    window.setTimeout(() => setFocusHint(false), 600);
    await handle.refocus({ x, y });
  };

  const handleToggleTorch = async () => {
    const handle = handleRef.current;
    if (!handle?.torchSupported) return;
    const next = !torchOn;
    const ok = await handle.setTorch(next);
    if (ok) setTorchOn(next);
  };

  const handleZoomBy = async (delta: number) => {
    const handle = handleRef.current;
    if (!handle) return;
    const next = await handle.setZoom(handle.getZoom() + delta);
    setZoom(next);
  };

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-zinc-950 text-zinc-50">
      <header className="px-4 pb-2 pt-5">
        <h1 className="text-xl font-bold tracking-tight">สแกนสินค้า</h1>
        <p className="mt-1 text-sm text-zinc-400">
          ซูมใกล้ด้วยปุ่ม ± แล้วถือห่างประมาณหนึ่งฝ่ามือ
          — ไม่ต้องดึงโทรศัพท์ชิดสติ๊กเกอร์
        </p>
      </header>

      <main className="flex flex-1 flex-col gap-4 px-4 pb-6">
        <div
          ref={stageRef}
          className="relative overflow-hidden rounded-xl bg-black"
          onPointerUp={(e) => {
            void handleTapToFocus(e);
          }}
        >
          <div
            ref={hostRef}
            className="min-h-[360px] w-full overflow-hidden [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
          />
          {phase === "scanning" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-[56%] w-[94%] rounded-md border-2 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.22)]" />
            </div>
          )}
          {phase === "scanning" && focusHint && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="rounded-full border border-white/80 px-3 py-1 text-xs text-white/90">
                กำลังโฟกัส…
              </div>
            </div>
          )}
          {phase === "boot" && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-400">
              กำลังเตรียมกล้อง…
            </div>
          )}
          {phase === "scanning" && (
            <div className="absolute bottom-3 left-3 right-3 flex flex-col gap-2">
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-9 flex-1 bg-black/55 text-white hover:bg-black/70"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleZoomBy(-SCAN_ZOOM_STEP);
                  }}
                >
                  <Minus className="size-4" />
                  ไกล
                </Button>
                <div className="flex h-9 min-w-16 items-center justify-center rounded-md bg-black/55 px-2 text-xs text-white">
                  {zoom.toFixed(1)}×
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-9 flex-1 bg-black/55 text-white hover:bg-black/70"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleZoomBy(SCAN_ZOOM_STEP);
                  }}
                >
                  <Plus className="size-4" />
                  ใกล้
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-9 flex-1 bg-black/55 text-white hover:bg-black/70"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleRef.current?.refocus();
                  }}
                >
                  <Focus className="size-4" />
                  โฟกัส
                </Button>
                {torchSupported && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-9 flex-1 bg-black/55 text-white hover:bg-black/70"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleToggleTorch();
                    }}
                  >
                    {torchOn ? (
                      <FlashlightOff className="size-4" />
                    ) : (
                      <Flashlight className="size-4" />
                    )}
                    {torchOn ? "ปิดไฟ" : "เปิดไฟ"}
                  </Button>
                )}
              </div>
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
        ใช้ซูม 2× เป็นค่าเริ่มต้น ถือห่างประมาณหนึ่งฝ่ามือ
        ให้เส้นบาร์โค้ดอยู่กลางกรอบ — ถ้ายังเล็ก กด “ใกล้”
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
