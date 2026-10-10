import { Capacitor } from "@capacitor/core";
import { App as NativeApp } from "@capacitor/app";
import { consumeNativeBack } from "./back-handlers";

export function isAndroidApp(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export async function initializeAndroid(): Promise<void> {
  if (!isAndroidApp()) return;
  await NativeApp.addListener("backButton", ({ canGoBack }) => {
    if (consumeNativeBack()) return;
    if (window.location.pathname !== "/") {
      if (canGoBack) window.history.back();
      else {
        window.history.replaceState(null, "", "/");
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    } else {
      // Drafts are already persisted by Zustand; exiting does not discard them.
      void NativeApp.exitApp();
    }
  });
}
