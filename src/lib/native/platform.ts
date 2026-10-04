import { Capacitor } from "@capacitor/core";
import { useSyncExternalStore } from "react";

/*
 * Uygulama mağaza kabuğunda (Capacitor) mı çalışıyor? Kabuk sayfaları sunucudan açar ve yerel
 * köprüyü sayfaya kendisi ekler; tarayıcıda bu değerler false/"web" döner.
 */
export type NativePlatform = "ios" | "android" | "web";

export const isNative = () => typeof window !== "undefined" && Capacitor.isNativePlatform();

export const nativePlatform = (): NativePlatform =>
  typeof window === "undefined" ? "web" : (Capacitor.getPlatform() as NativePlatform);

const noop = () => () => {};

/** Sunucuda false; istemcide kabuğa göre (hidrasyon uyumsuzluğu olmadan). */
export function useIsNative() {
  return useSyncExternalStore(noop, isNative, () => false);
}
