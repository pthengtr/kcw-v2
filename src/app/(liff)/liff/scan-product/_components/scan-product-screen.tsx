"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  ImageUp,
  RotateCcw,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { decodeBarcodeFromImageFile } from "@/lib/liff/barcode-scanner";
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
  | "reading"
  | "no_code"
  | "outside_line"
  | "liff_error";

export default function ScanProductScreen() {
  const [liffState, setLiffState] = useState<LiffInitResult | null>(null);
  const [phase, setPhase] = useState<UiPhase>("boot");
  const [detected, setDetected] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submit, setSubmit] = useState<ScanSubmitState>({ status: "idle" });
  const [readError, setReadError] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const aliveRef = useRef(true);
  const submitRef = useRef(submit);
  const previewUrlRef = useRef<string | null>(null);

  submitRef.current = submit;

  const clearPreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
  }, []);

  const handleDecoded = useCallback(async (barcode: string) => {
    const next = beginSubmit(submitRef.current, barcode);
    if (!next) return;

    setDetected(barcode);
    setSubmit(next);
    setPhase("ready");

    if (!canSendChatMessage()) {
      setSubmit(
        markError(
          barcode,
          "อ่านรหัสได้แล้ว แต่ส่งกลับแชทได้เฉพาะเมื่อเปิดจาก LINE เท่านั้น"
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
  }, []);

  const processFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file || !aliveRef.current) return;

      setReadError(null);
      setDetected(null);
      setSubmit(resetSubmit());
      setPhase("reading");

      clearPreview();
      const url = URL.createObjectURL(file);
      previewUrlRef.current = url;
      setPreviewUrl(url);

      try {
        const code = await decodeBarcodeFromImageFile(file);
        if (!aliveRef.current) return;
        if (!code) {
          setPhase("no_code");
          setReadError(
            "ไม่พบบาร์โค้ดในรูป ลองถ่ายใหม่ให้ชัด เส้นบาร์โค้ดอยู่กลางภาพ"
          );
          return;
        }
        await handleDecoded(code);
      } catch (err) {
        if (!aliveRef.current) return;
        const message =
          err instanceof Error ? err.message : "อ่านบาร์โค้ดจากรูปไม่สำเร็จ";
        setPhase("no_code");
        setReadError(message);
      }
    },
    [clearPreview, handleDecoded]
  );

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
    })();

    return () => {
      cancelled = true;
      aliveRef.current = false;
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  const handleRetry = () => {
    setDetected(null);
    setReadError(null);
    setSubmit(resetSubmit());
    clearPreview();
    setPhase(
      liffState && liffState.ok && !liffState.inClient
        ? "outside_line"
        : "ready"
    );
  };

  const busy = phase === "reading" || submit.status === "submitting";

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-zinc-950 text-zinc-50">
      <header className="px-4 pb-2 pt-5">
        <h1 className="text-xl font-bold tracking-tight">สแกนสินค้า</h1>
        <p className="mt-1 text-sm text-zinc-400">
          ถ่ายรูปหรืออัปโหลดรูปบาร์โค้ดให้ชัด
          — ใช้กล้องของเครื่องโฟกัสแล้วค่อยอ่านจากรูปนิ่ง
        </p>
      </header>

      <main className="flex flex-1 flex-col gap-4 px-4 pb-6">
        <div className="relative overflow-hidden rounded-xl bg-zinc-900">
          <div className="flex min-h-[280px] w-full items-center justify-center">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="รูปที่เลือก"
                className="max-h-[360px] w-full object-contain"
              />
            ) : (
              <div className="px-6 py-16 text-center text-sm text-zinc-400">
                ยังไม่มีรูป — กดถ่ายหรืออัปโหลดด้านล่าง
              </div>
            )}
          </div>
          {phase === "reading" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-sm">
              กำลังอ่านบาร์โค้ด…
            </div>
          )}
        </div>

        <StatusPanel
          phase={phase}
          liffState={liffState}
          detected={detected}
          submit={submit}
          readError={readError}
        />

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            void processFile(file);
          }}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            void processFile(file);
          }}
        />

        <div className="mt-auto flex flex-col gap-2">
          {submit.status !== "sent" && phase !== "liff_error" && (
            <>
              <Button
                type="button"
                className="h-11 w-full"
                disabled={busy}
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="size-4" />
                ถ่ายรูปบาร์โค้ด
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="h-11 w-full"
                disabled={busy}
                onClick={() => galleryInputRef.current?.click()}
              >
                <ImageUp className="size-4" />
                อัปโหลดจากคลังรูป
              </Button>
            </>
          )}

          {(phase === "no_code" ||
            submit.status === "error" ||
            (phase === "ready" && previewUrl)) && (
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full"
              disabled={busy}
              onClick={handleRetry}
            >
              <RotateCcw className="size-4" />
              ล้างแล้วลองใหม่
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
  readError,
}: {
  phase: UiPhase;
  liffState: LiffInitResult | null;
  detected: string | null;
  submit: ScanSubmitState;
  readError: string | null;
}) {
  if (phase === "liff_error") {
    return (
      <Alert tone="error" title="เปิด LIFF ไม่สำเร็จ">
        {liffState && !liffState.ok ? liffState.error : "เกิดข้อผิดพลาด"}
      </Alert>
    );
  }

  if (phase === "boot") {
    return (
      <Alert tone="info" title="กำลังเตรียม…">
        รอสักครู่
      </Alert>
    );
  }

  if (phase === "reading") {
    return (
      <Alert tone="info" title="กำลังอ่านบาร์โค้ดจากรูป…">
        รอสักครู่
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

  if (phase === "no_code") {
    return (
      <Alert tone="error" title="อ่านบาร์โค้ดไม่สำเร็จ">
        {readError || "ไม่พบบาร์โค้ดในรูป"}
      </Alert>
    );
  }

  if (phase === "outside_line") {
    return (
      <Alert tone="warn" title="เปิดนอก LINE">
        ถ่าย/อัปโหลดทดสอบได้ แต่ส่งผลกลับแชทบอทได้เฉพาะเมื่อเปิดจากปุ่มใน LINE
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
    <Alert tone="info" title="พร้อมถ่ายรูป">
      <span className="inline-flex items-center gap-1.5">
        <Camera className="size-3.5" />
        ถ่ายให้เส้นบาร์โค้ดชัดและอยู่กลางภาพ แล้วระบบจะอ่านจากรูปนิ่ง
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
