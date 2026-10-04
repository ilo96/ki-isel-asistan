import { describe, expect, it } from "vitest";
import { isAppUserAgent, shouldSendToLanding } from "./app-client";

const APP_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 VantrelApp/1";
const BROWSER_UA = "Mozilla/5.0 (Linux; Android 16; Pixel 9) Chrome/141.0 Mobile Safari/537.36";

describe("app-client", () => {
  it("uygulama kabuğunun işaretini tanır", () => {
    expect(isAppUserAgent(APP_UA)).toBe(true);
    expect(isAppUserAgent(BROWSER_UA)).toBe(false);
    expect(isAppUserAgent(null)).toBe(false);
  });

  it("yalnızca uygulama modunda tarayıcıyı tanıtım sayfasına yollar", () => {
    expect(shouldSendToLanding({ appOnly: false, pathname: "/home", userAgent: BROWSER_UA })).toBe(false);
    expect(shouldSendToLanding({ appOnly: true, pathname: "/home", userAgent: BROWSER_UA })).toBe(true);
    expect(shouldSendToLanding({ appOnly: true, pathname: "/", userAgent: BROWSER_UA })).toBe(true);
    expect(shouldSendToLanding({ appOnly: true, pathname: "/home", userAgent: APP_UA })).toBe(false);
  });

  it("e-postadaki şifre sıfırlama bağlantısı tarayıcıda da açılır", () => {
    expect(shouldSendToLanding({ appOnly: true, pathname: "/reset-password", userAgent: BROWSER_UA })).toBe(false);
  });
});
