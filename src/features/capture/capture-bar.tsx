"use client";

import { Camera, Loader2, Mic, Square } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { draftFromSpeechAction } from "@/features/finance/capture-actions";
import type { TransactionDraft } from "@/lib/finance/draft";
import { fadeTransition } from "@/lib/motion";
import { scanReceipt } from "./scan-receipt";
import { useSpeech, useSpeechSupported } from "./use-speech";

export type CaptureMode = "voice" | "receipt";

/**
 * Hızlı ekle'nin üstündeki "Söyle" ve "Fiş tara" düğmeleri. İkisi de formu doldurur;
 * kayıt her zaman kullanıcının Kaydet'iyle olur. autoStart ana ekran kısayolundan gelir.
 */
export function CaptureBar({
  receiptScan,
  onDraft,
  autoStart,
}: {
  receiptScan: boolean;
  onDraft: (draft: TransactionDraft) => void;
  autoStart?: CaptureMode | null;
}) {
  const t = useTranslations("capture");
  const toast = useToast();
  const supported = useSpeechSupported();
  const file = useRef<HTMLInputElement>(null);
  const [parsing, startParse] = useTransition();
  const [scanning, setScanning] = useState(false);

  const speech = useSpeech({
    onFinal: (text) =>
      startParse(async () => {
        const draft = await draftFromSpeechAction(text);
        if (draft) onDraft(draft);
        else toast({ message: t("voiceFailed"), tone: "error" });
      }),
  });

  useEffect(() => {
    if (speech.error) toast({ message: t(`voiceErrors.${speech.error}`), tone: "error" });
  }, [speech.error, t, toast]);

  // Kısayoldan gelindiyse bir kez başlat (fiş için dosya seçici kullanıcı hareketi ister;
  // tarayıcı engellerse düğme yine orada).
  const started = useRef(false);
  useEffect(() => {
    if (!autoStart || started.current) return;
    if (autoStart === "voice") {
      if (!supported) return;
      speech.start();
    } else file.current?.click();
    started.current = true;
  }, [autoStart, supported, speech]);

  const pickReceipt = () => {
    if (!receiptScan) {
      toast({ message: t("receiptNotConfigured") });
      return;
    }
    file.current?.click();
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setScanning(true);
    const result = await scanReceipt(f);
    setScanning(false);
    if (file.current) file.current.value = "";
    if (result.ok) onDraft(result.draft);
    else toast({ message: t(`receiptErrors.${result.error}`), tone: "error" });
  };

  const listening = speech.state === "listening";
  const busy = parsing || scanning;

  return (
    <div className="mb-5">
      <input
        ref={file}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      <AnimatePresence mode="wait" initial={false}>
        {listening || busy ? (
          <motion.div
            key="live"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={fadeTransition}
            className="flex items-center gap-3 rounded-card bg-accent-soft px-4 py-3"
            role="status"
            aria-live="polite"
          >
            {listening ? (
              <span className="relative grid size-9 shrink-0 place-items-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-accent/30 motion-reduce:animate-none" />
                <Mic className="relative size-5 text-accent" aria-hidden />
              </span>
            ) : (
              <Loader2 className="size-5 shrink-0 animate-spin text-accent" aria-hidden />
            )}
            <p className="min-w-0 flex-1 text-small text-text">
              {listening
                ? speech.interim || t("listening")
                : scanning
                  ? t("scanning")
                  : t("understanding")}
            </p>
            {listening && (
              <button
                type="button"
                onClick={speech.stop}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface px-3 text-small text-text shadow-card"
              >
                <Square className="size-3.5 fill-current" aria-hidden />
                {t("done")}
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="buttons"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fadeTransition}
            className="grid grid-cols-2 gap-2"
          >
            {supported ? (
              <button
                type="button"
                onClick={speech.start}
                className="flex h-12 items-center justify-center gap-2 rounded-button border border-border bg-surface text-small text-text transition-colors hover:border-accent/50"
              >
                <Mic className="size-[18px] text-accent" aria-hidden />
                {t("voice")}
              </button>
            ) : (
              <p className="flex h-12 items-center justify-center rounded-button bg-surface-muted px-2 text-center text-caption text-muted">
                {t("voiceUnsupported")}
              </p>
            )}
            <button
              type="button"
              onClick={pickReceipt}
              className="flex h-12 items-center justify-center gap-2 rounded-button border border-border bg-surface text-small text-text transition-colors hover:border-accent/50"
            >
              <Camera className="size-[18px] text-accent" aria-hidden />
              {t("receipt")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
