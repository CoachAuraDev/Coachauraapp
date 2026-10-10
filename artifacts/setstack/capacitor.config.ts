import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.setstack.trainer",
  appName: "CoachAura",
  webDir: "dist/public",
  backgroundColor: "#0B0B0D",
  // Always bundle the built app. No development URL or Replit server is required.
  server: {
    hostname: "localhost",
    androidScheme: "https",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#0B0B0D",
  },
  plugins: {
    SystemBars: {
      // Capacitor 8.5 handles system/keyboard insets natively when viewport-fit
      // is not "cover", including WebViews predating Chromium 140.
      insetsHandling: "native",
      style: "DARK",
      hidden: false,
    },
  },
};

export default config;
