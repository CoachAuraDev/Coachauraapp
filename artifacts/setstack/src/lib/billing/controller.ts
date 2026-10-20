import { Capacitor, registerPlugin } from "@capacitor/core";
import { App as NativeApp } from "@capacitor/app";
import {
  hasPendingLifetime,
  hasPurchasedLifetime,
  initialBillingSnapshot,
  LIFETIME_PRODUCT_ID,
  type BillingSnapshot,
  type PlayPurchaseRecord,
} from "./entitlement.ts";
import { setBillingAccessSource } from "./access.ts";

type RuntimeInfo = { android: boolean; debugBuild: boolean };
type ProductInfo = { available: boolean; formattedPrice?: string; message?: string };
type QueryResult = {
  available: boolean;
  purchases: PlayPurchaseRecord[];
  message?: string;
};
type PurchaseResult = {
  status: "purchased" | "pending" | "cancelled" | "error";
  message?: string;
};
type PurchaseUpdate = { acknowledgement?: "acknowledged" | "retry" };

export type PlayBillingBridge = {
  getRuntime(): Promise<RuntimeInfo>;
  getProductDetails(options: { productId: string }): Promise<ProductInfo>;
  queryPurchases(): Promise<QueryResult>;
  purchase(options: { productId: string }): Promise<PurchaseResult>;
  addListener?(
    eventName: "purchaseUpdated",
    listener: (event: PurchaseUpdate) => void,
  ): Promise<{ remove(): Promise<void> }>;
};

type NativePlayBillingPlugin = {
  getRuntime(): Promise<RuntimeInfo>;
  getProductDetails(options: { productId: string }): Promise<ProductInfo>;
  queryPurchases(): Promise<QueryResult>;
  purchase(options: { productId: string }): Promise<PurchaseResult>;
  addListener(
    eventName: "purchaseUpdated",
    listener: (event: PurchaseUpdate) => void,
  ): Promise<{ remove(): Promise<void> }>;
};

const NativePlayBilling = registerPlugin<NativePlayBillingPlugin>("PlayBilling");

export class BillingController {
  private snapshot: BillingSnapshot = initialBillingSnapshot;
  private readonly listeners = new Set<() => void>();
  private refreshInFlight: Promise<void> | null = null;
  private readonly bridge: PlayBillingBridge;
  private readonly isAndroid: () => boolean;

  constructor(bridge: PlayBillingBridge, isAndroid: () => boolean) {
    this.bridge = bridge;
    this.isAndroid = isAndroid;
  }

  getSnapshot = (): BillingSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  hasLifetimeAccess = (): boolean =>
    this.snapshot.status === "lifetime" &&
    this.snapshot.source === "play";

  private publish(snapshot: BillingSnapshot): void {
    this.snapshot = snapshot;
    setBillingAccessSource(snapshot.source);
    this.listeners.forEach((listener) => listener());
  }

  async refresh(): Promise<void> {
    if (this.refreshInFlight) return this.refreshInFlight;
    this.refreshInFlight = this.refreshPurchases().finally(() => {
      this.refreshInFlight = null;
    });
    return this.refreshInFlight;
  }

  async handlePurchaseUpdate(event: PurchaseUpdate = {}): Promise<void> {
    if (event.acknowledgement === "retry") {
      this.publish({
        ...this.snapshot,
        message: "Google Play could not acknowledge this purchase yet. Recheck later; Google Play may refund purchases that remain unacknowledged.",
      });
      return;
    }
    await this.refresh();
  }

  private async refreshPurchases(): Promise<void> {
    const old = this.snapshot;
    this.publish({ ...old, status: "checking", source: null, busy: false, message: "" });
    if (!this.isAndroid()) {
      this.publish({
        ...this.snapshot,
        status: "unavailable",
        message: "Google Play Billing works in an Android build. It cannot be tested from this browser preview.",
      });
      return;
    }

    try {
      const runtime = await this.bridge.getRuntime();
      if (!runtime.android) {
        this.publish({
          ...this.snapshot,
          status: "unavailable",
          message: "Google Play Billing is not available in this app environment.",
        });
        return;
      }
      const query = await this.bridge.queryPurchases();
      const product = await this.bridge.getProductDetails({ productId: LIFETIME_PRODUCT_ID });
      const price = product.available ? product.formattedPrice ?? null : null;
      if (!query.available) {
        this.publish({
          ...this.snapshot,
          status: "unavailable",
          source: null,
          price,
          message: query.message || "Google Play Billing could not check purchases. Try again when Google Play is available.",
        });
      } else if (hasPurchasedLifetime(query.purchases)) {
        this.publish({
          ...this.snapshot,
          status: "lifetime",
          source: "play",
          price,
          message: "Lifetime access confirmed by Google Play.",
        });
      } else if (hasPendingLifetime(query.purchases)) {
        this.publish({
          ...this.snapshot,
          status: "pending",
          source: null,
          price,
          message: "Google Play is still processing your payment. Access stays locked until it confirms the purchase.",
        });
      } else if (!product.available) {
        this.publish({
          ...this.snapshot,
          status: "unavailable",
          source: null,
          price: null,
          message: product.message || "The lifetime product is not available from Google Play yet.",
        });
      } else {
        this.publish({
          ...this.snapshot,
          status: "free",
          source: null,
          price,
          message: "",
        });
      }
    } catch (error) {
      this.publish({
        ...this.snapshot,
        status: "unavailable",
        source: null,
        message: error instanceof Error
          ? `Google Play Billing is unavailable: ${error.message}`
          : "Google Play Billing is unavailable. Try again later.",
      });
    }
  }

  async purchase(): Promise<void> {
    if (!this.isAndroid()) {
      this.publish({
        ...this.snapshot,
        status: "unavailable",
        message: "Use CoachAura on Android with Google Play Billing available to make this purchase.",
      });
      return;
    }
    this.publish({ ...this.snapshot, busy: true, message: "Opening Google Play…" });
    try {
      const result = await this.bridge.purchase({ productId: LIFETIME_PRODUCT_ID });
      await this.refresh();
      const refreshed = this.snapshot;
      if (result.status === "cancelled") {
        this.publish({ ...refreshed, message: "Purchase cancelled. No lifetime access was added." });
      } else if (result.status === "pending" && refreshed.status !== "lifetime") {
        this.publish({
          ...refreshed,
          status: "pending",
          source: null,
          message: result.message || "Payment is pending in Google Play. Access will unlock after it is confirmed.",
        });
      } else if (result.status === "error" && refreshed.status !== "lifetime") {
        this.publish({
          ...refreshed,
          status: refreshed.status === "unavailable" ? "unavailable" : "error",
          message: result.message || "Google Play could not complete the purchase. You can retry or restore purchases.",
        });
      } else if (refreshed.status !== "lifetime") {
        this.publish({
          ...refreshed,
          status: "error",
          message: "Google Play has not confirmed ownership yet. No access was unlocked; use Restore / recheck to try again.",
        });
      }
    } catch (error) {
      this.publish({
        ...this.snapshot,
        status: "error",
        source: null,
        message: error instanceof Error ? error.message : "Google Play could not complete the purchase.",
      });
    } finally {
      this.publish({ ...this.snapshot, busy: false });
    }
  }

}

export const billingController = new BillingController(
  {
    getRuntime: () => NativePlayBilling.getRuntime(),
    getProductDetails: (options) => NativePlayBilling.getProductDetails(options),
    queryPurchases: () => NativePlayBilling.queryPurchases(),
    purchase: (options) => NativePlayBilling.purchase(options),
    addListener: (eventName, listener) => NativePlayBilling.addListener(eventName, listener),
  },
  () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android",
);

let listenersRegistered = false;

export async function initializePlayBilling(): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
    await billingController.refresh();
    return;
  }
  if (!listenersRegistered) {
    listenersRegistered = true;
    try {
      await NativePlayBilling.addListener("purchaseUpdated", (event) => {
        void billingController.handlePurchaseUpdate(event);
      });
      await NativeApp.addListener("appStateChange", ({ isActive }) => {
        if (isActive) void billingController.refresh();
      });
      window.addEventListener("focus", () => void billingController.refresh());
    } catch {
      // The explicit refresh below will surface bridge failures in the UI.
    }
  }
  await billingController.refresh();
}
