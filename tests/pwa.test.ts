import { describe, expect, it } from "vitest";
import { detectPlatform, installMode, isStandalone, shouldRegisterServiceWorker } from "../src/lib/pwa";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPAD_DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36";
const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

describe("detectPlatform", () => {
  it("recognises iPhone", () => {
    expect(detectPlatform(IPHONE, 5)).toBe("ios");
  });
  it("recognises an iPad that reports a desktop Mac user agent", () => {
    expect(detectPlatform(IPAD_DESKTOP_UA, 5)).toBe("ios");
  });
  it("treats a real Mac (no touch) as desktop", () => {
    expect(detectPlatform(IPAD_DESKTOP_UA, 0)).toBe("desktop");
  });
  it("recognises Android", () => {
    expect(detectPlatform(ANDROID, 5)).toBe("android");
  });
  it("treats Windows as desktop", () => {
    expect(detectPlatform(WINDOWS, 0)).toBe("desktop");
  });
});

describe("isStandalone", () => {
  it("is true when the display-mode media query matches", () => {
    expect(isStandalone(true, undefined)).toBe(true);
  });
  it("is true for iOS home-screen apps", () => {
    expect(isStandalone(false, true)).toBe(true);
  });
  it("is false in a normal browser tab", () => {
    expect(isStandalone(false, undefined)).toBe(false);
  });
});

describe("installMode", () => {
  it("hides the install option once installed", () => {
    expect(installMode({ platform: "android", standalone: true, canPrompt: true })).toBe("installed");
  });
  it("uses the browser prompt when one is available", () => {
    expect(installMode({ platform: "desktop", standalone: false, canPrompt: true })).toBe("prompt");
  });
  it("shows the Add to Home Screen guide on iPhone", () => {
    expect(installMode({ platform: "ios", standalone: false, canPrompt: false })).toBe("ios-guide");
  });
  it("falls back to manual browser-menu steps elsewhere", () => {
    expect(installMode({ platform: "android", standalone: false, canPrompt: false })).toBe("manual");
  });
});

describe("shouldRegisterServiceWorker", () => {
  it("registers in a production build when supported", () => {
    expect(shouldRegisterServiceWorker({ supported: true, prod: true, mode: "production" })).toBe(true);
  });
  it("skips development so stale caches never hide code changes", () => {
    expect(shouldRegisterServiceWorker({ supported: true, prod: false, mode: "development" })).toBe(false);
  });
  it("skips the single-file embed build", () => {
    expect(shouldRegisterServiceWorker({ supported: true, prod: true, mode: "single" })).toBe(false);
  });
  it("skips browsers without service workers", () => {
    expect(shouldRegisterServiceWorker({ supported: false, prod: true, mode: "production" })).toBe(false);
  });
});
