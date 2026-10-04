"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { isNative } from "@/lib/native/platform";

/*
 * Tarayıcının konuşma tanıma API'si (Web Speech). Chrome, Edge ve Safari'de var; Firefox'ta
 * yok, orada mikrofon düğmesi hiç görünmez. Ses tanımayı tarayıcı kendi hizmetiyle yapar;
 * uygulamaya yalnızca metin gelir. Mağaza uygulamasında web görünümünde bu API olmadığı için
 * telefonun kendi konuşma tanıması (yerel eklenti) kullanılır.
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
    () => isNative() || ctor() !== null,
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
  const rec = useRef<Pick<Recognition, "stop" | "abort"> | null>(null);
  const finalText = useRef("");
  const onFinalRef = useRef(onFinal);
  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  useEffect(() => () => rec.current?.abort(), []);

  const start = useCallback(() => {
    if (isNative()) {
      if (rec.current) return;
      setInterim("");
      setError(null);
      void startNative({
        lang,
        onStart: (handle) => {
          rec.current = handle;
          setState("listening");
        },
        onInterim: setInterim,
        onError: (e) => {
          rec.current = null;
          setState("idle");
          setError(e);
        },
        onEnd: (text) => {
          rec.current = null;
          setState("idle");
          if (text) onFinalRef.current(text);
        },
      });
      return;
    }
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

/** Yerel konuşma tanıma: kısmi sonuçlar her seferinde o ana kadarki metnin tamamıdır. */
async function startNative(cb: {
  lang: string;
  onStart: (handle: Pick<Recognition, "stop" | "abort">) => void;
  onInterim: (text: string) => void;
  onError: (error: SpeechError) => void;
  onEnd: (text: string) => void;
}) {
  const { SpeechRecognition } = await import("@capgo/capacitor-speech-recognition");
  try {
    const { available } = await SpeechRecognition.available();
    if (!available) return cb.onError("unknown");
    const perm = await SpeechRecognition.requestPermissions();
    if (perm.speechRecognition !== "granted") return cb.onError("denied");
  } catch {
    return cb.onError("unknown");
  }

  let latest = "";
  let done = false;
  const finish = (keep: boolean) => {
    if (done) return;
    done = true;
    void SpeechRecognition.removeAllListeners();
    cb.onEnd(keep ? latest.trim() : "");
  };
  await SpeechRecognition.removeAllListeners();
  await SpeechRecognition.addListener("partialResults", ({ matches, accumulatedText }) => {
    latest = accumulatedText ?? matches?.[0] ?? latest;
    cb.onInterim(latest.trim());
  });
  await SpeechRecognition.addListener("listeningState", ({ state, status }) => {
    if (state === "stopped" || status === "stopped") finish(true);
  });
  cb.onStart({
    stop: () => void SpeechRecognition.stop().finally(() => finish(true)),
    abort: () => void SpeechRecognition.stop().finally(() => finish(false)),
  });
  try {
    await SpeechRecognition.start({ language: cb.lang, partialResults: true, popup: false, maxResults: 1 });
  } catch {
    done = true;
    void SpeechRecognition.removeAllListeners();
    cb.onError("no-speech");
  }
}
