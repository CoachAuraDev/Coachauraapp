export const LIFETIME_PRODUCT_ID = "coachaura_lifetime";
export const FREE_CLIENT_LIMIT = 3;

export type PlayPurchaseState = "PURCHASED" | "PENDING" | "CANCELLED";

export type PlayPurchaseRecord = {
  productId: string;
  state: PlayPurchaseState;
};

export type BillingStatus =
  | "checking"
  | "free"
  | "lifetime"
  | "pending"
  | "unavailable"
  | "error";

export type BillingSnapshot = {
  status: BillingStatus;
  source: "play" | null;
  price: string | null;
  message: string;
  busy: boolean;
};

export const initialBillingSnapshot: BillingSnapshot = {
  status: "checking",
  source: null,
  price: null,
  message: "",
  busy: false,
};

export function hasPurchasedLifetime(purchases: readonly PlayPurchaseRecord[]): boolean {
  return purchases.some(
    (purchase) =>
      purchase.productId === LIFETIME_PRODUCT_ID &&
      purchase.state === "PURCHASED",
  );
}

export function hasPendingLifetime(purchases: readonly PlayPurchaseRecord[]): boolean {
  return purchases.some(
    (purchase) =>
      purchase.productId === LIFETIME_PRODUCT_ID &&
      purchase.state === "PENDING",
  );
}

export function canCreateClient(clientCount: number, hasLifetime: boolean): boolean {
  return hasLifetime || clientCount < FREE_CLIENT_LIMIT;
}
