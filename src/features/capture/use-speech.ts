"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/*
 * Tarayıcının konuşma tanıma API'si (Web Speech). Chrome, Edge ve Safari'de var; Firefox'ta
 * yok, orada mikrofon düğmesi hiç görünmez. Ses tanımayı tarayıcı kendi hizmetiyle yapar;
 * uygulamaya yalnızca metin gelir.
 */

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionCtor = new () => Recognition;

function ctor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noop = () => () => {};
/** Sunucuda false; istemcide tarayıcı desteğine göre (hidrasyon uyumsuzluğu olmadan). */
export function useSpeechSupported() {
  return useSyncExternalStore(
    noop,
    () => ctor() !== null,
    () => false,
  );
}

export type SpeechError = "denied" | "no-speech" | "network" | "unknown";
export type SpeechState = "idle" | "listening";

export function useSpeech({
  onFinal,
  lang = "tr-TR",
}: {
  onFinal: (text: string) => void;
  lang?: string;
}) {
  const [state, setState] = useState<SpeechState>("idle");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<SpeechError | null>(null);
  const rec = useRef<Recognition | null>(null);
  const finalText = useRef("");
  const onFinalRef = useRef(onFinal);
  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  useEffect(() => () => rec.current?.abort(), []);

  const start = useCallback(() => {
    const Ctor = ctor();
    if (!Ctor || rec.current) return;
    const r = new Ctor();
    r.lang = lang;
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    finalText.current = "";
    setInterim("");
    setError(null);
    r.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        if (res.isFinal) finalText.current += res[0].transcript;
        else live += res[0].transcript;
      }
      setInterim((finalText.current + live).trim());
    };
    r.onerror = (e) => {
      setError(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "denied"
          : e.error === "no-speech"
            ? "no-speech"
            : e.error === "network"
              ? "network"
              : e.error === "aborted"
                ? null
                : "unknown",
      );
    };
    r.onend = () => {
      rec.current = null;
      setState("idle");
      const text = finalText.current.trim();
      if (text) onFinalRef.current(text);
    };
    rec.current = r;
    setState("listening");
    try {
      r.start();
    } catch {
      rec.current = null;
      setState("idle");
      setError("unknown");
    }
  }, [lang]);

  const stop = useCallback(() => rec.current?.stop(), []);

  return { state, interim, error, start, stop };
}
