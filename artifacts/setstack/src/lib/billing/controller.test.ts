import assert from "node:assert/strict";
import test from "node:test";
import { BillingController, type PlayBillingBridge } from "./controller.ts";
import { LIFETIME_PRODUCT_ID, type PlayPurchaseRecord } from "./entitlement.ts";

function fakeBridge({
  purchases = [],
  purchaseStatus = "purchased",
  debugBuild = false,
  billingAvailable = true,
}: {
  purchases?: PlayPurchaseRecord[];
  purchaseStatus?: "purchased" | "pending" | "cancelled" | "error";
  debugBuild?: boolean;
  billingAvailable?: boolean;
} = {}) {
  let owned = [...purchases];
  let queryCount = 0;
  const bridge: PlayBillingBridge = {
    async getRuntime() { return { android: true, debugBuild }; },
    async getProductDetails() {
      return billingAvailable
        ? { available: true, formattedPrice: "499 kr" }
        : { available: false, message: "Product unavailable in this test." };
    },
    async queryPurchases() {
      queryCount += 1;
      return billingAvailable
        ? { available: true, purchases: owned }
        : { available: false, purchases: [], message: "Billing unavailable in this test." };
    },
    async purchase() {
      if (purchaseStatus === "purchased" && owned.length === 0) {
        // Test the critical case where the callback says success but Play's
        // ownership query has not confirmed the item.
      }
      return { status: purchaseStatus, message: "Test purchase result." };
    },
  };
  return {
    bridge,
    setOwned(next: PlayPurchaseRecord[]) { owned = [...next]; },
    getQueryCount() { return queryCount; },
  };
}

const purchased = [{ productId: LIFETIME_PRODUCT_ID, state: "PURCHASED" as const }];
const pending = [{ productId: LIFETIME_PRODUCT_ID, state: "PENDING" as const }];

test("purchase callback cannot grant access until a purchase query confirms ownership", async () => {
  const fake = fakeBridge({ purchaseStatus: "purchased" });
  const controller = new BillingController(fake.bridge, () => true);
  await controller.refresh();
  await controller.purchase();
  assert.equal(controller.getSnapshot().status, "error");
  assert.equal(controller.hasLifetimeAccess(), false);
});

test("a cancelled purchase remains on the free tier", async () => {
  const fake = fakeBridge({ purchaseStatus: "cancelled" });
  const controller = new BillingController(fake.bridge, () => true);
  await controller.refresh();
  await controller.purchase();
  assert.equal(controller.getSnapshot().status, "free");
  assert.match(controller.getSnapshot().message, /cancelled/i);
  assert.equal(controller.hasLifetimeAccess(), false);
});

test("a pending Play purchase does not unlock clients", async () => {
  const fake = fakeBridge({ purchaseStatus: "pending" });
  const controller = new BillingController(fake.bridge, () => true);
  await controller.refresh();
  await controller.purchase();
  assert.equal(controller.getSnapshot().status, "pending");
  assert.equal(controller.hasLifetimeAccess(), false);
});

test("a confirmed purchase is restored by a fresh controller after restart", async () => {
  const fake = fakeBridge({ purchases: purchased });
  const firstSession = new BillingController(fake.bridge, () => true);
  await firstSession.refresh();
  assert.equal(firstSession.hasLifetimeAccess(), true);

  const afterRestart = new BillingController(fake.bridge, () => true);
  await afterRestart.refresh();
  assert.equal(afterRestart.getSnapshot().source, "play");
  assert.equal(afterRestart.hasLifetimeAccess(), true);
});

test("a later Play query can confirm a pending purchase", async () => {
  const fake = fakeBridge({ purchases: pending });
  const controller = new BillingController(fake.bridge, () => true);
  await controller.refresh();
  assert.equal(controller.getSnapshot().status, "pending");
  fake.setOwned(purchased);
  await controller.refresh();
  assert.equal(controller.hasLifetimeAccess(), true);
});

test("an acknowledgement retry warning does not trigger a purchase-query retry loop", async () => {
  const fake = fakeBridge({ purchases: purchased });
  const controller = new BillingController(fake.bridge, () => true);
  await controller.refresh();
  const queriesBeforeWarning = fake.getQueryCount();

  await controller.handlePurchaseUpdate({ acknowledgement: "retry" });

  assert.equal(fake.getQueryCount(), queriesBeforeWarning);
  assert.equal(controller.hasLifetimeAccess(), true);
  assert.match(controller.getSnapshot().message, /could not acknowledge/i);

  const next = fakeBridge();
  const nextController = new BillingController(next.bridge, () => true);
  await nextController.refresh();
  next.setOwned(purchased);
  await nextController.handlePurchaseUpdate();
  assert.equal(nextController.hasLifetimeAccess(), true);
});

test("price is sourced from Play product details and billing errors fail closed", async () => {
  const available = new BillingController(fakeBridge().bridge, () => true);
  await available.refresh();
  assert.equal(available.getSnapshot().price, "499 kr");
  assert.equal(available.getSnapshot().status, "free");

  const unavailable = new BillingController(fakeBridge({ billingAvailable: false }).bridge, () => true);
  await unavailable.refresh();
  assert.equal(unavailable.getSnapshot().status, "unavailable");
  assert.equal(unavailable.hasLifetimeAccess(), false);
});

test("the development override is accepted only in an Android debug build", async () => {
  const release = new BillingController(fakeBridge({ debugBuild: false }).bridge, () => true);
  await release.refresh();
  assert.equal(release.setDebugSimulation(true), false);
  assert.equal(release.hasLifetimeAccess(), false);

  const debug = new BillingController(fakeBridge({ debugBuild: true }).bridge, () => true);
  await debug.refresh();
  assert.equal(debug.setDebugSimulation(true), true);
  assert.equal(debug.getSnapshot().source, "debug");
  assert.equal(debug.hasLifetimeAccess(), true);
});

test("an Android purchase in a non-Android environment fails closed", async () => {
  const controller = new BillingController(fakeBridge({ purchases: purchased }).bridge, () => false);
  await controller.refresh();
  assert.equal(controller.getSnapshot().status, "unavailable");
  assert.equal(controller.hasLifetimeAccess(), false);
});
