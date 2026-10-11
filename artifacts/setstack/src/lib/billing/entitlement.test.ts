import assert from "node:assert/strict";
import test from "node:test";
import {
  canCreateClient,
  FREE_CLIENT_LIMIT,
  hasPendingLifetime,
  hasPurchasedLifetime,
  LIFETIME_PRODUCT_ID,
} from "./entitlement.ts";

test("free client allowance stops at three without hiding existing records", () => {
  assert.equal(FREE_CLIENT_LIMIT, 3);
  assert.equal(canCreateClient(0, false), true);
  assert.equal(canCreateClient(2, false), true);
  assert.equal(canCreateClient(3, false), false);
  assert.equal(canCreateClient(4, false), false);
});

test("confirmed lifetime access permits client creation beyond the free limit", () => {
  assert.equal(canCreateClient(3, true), true);
  assert.equal(canCreateClient(100, true), true);
});

test("only this product in PURCHASED state grants lifetime entitlement", () => {
  assert.equal(hasPurchasedLifetime([{ productId: LIFETIME_PRODUCT_ID, state: "PURCHASED" }]), true);
  assert.equal(hasPurchasedLifetime([{ productId: "other_product", state: "PURCHASED" }]), false);
  assert.equal(hasPurchasedLifetime([{ productId: LIFETIME_PRODUCT_ID, state: "PENDING" }]), false);
  assert.equal(hasPurchasedLifetime([{ productId: LIFETIME_PRODUCT_ID, state: "CANCELLED" }]), false);
});

test("pending lifetime purchases remain pending and never grant access", () => {
  const records = [{ productId: LIFETIME_PRODUCT_ID, state: "PENDING" as const }];
  assert.equal(hasPendingLifetime(records), true);
  assert.equal(hasPurchasedLifetime(records), false);
});
