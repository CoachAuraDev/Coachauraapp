package app.coachaura.trainer;

import android.content.pm.ApplicationInfo;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryProductDetailsResult;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.Queue;

@CapacitorPlugin(name = "PlayBilling")
public final class PlayBillingPlugin extends Plugin implements PurchasesUpdatedListener {
    private static final String PRODUCT_ID = "coachaura_lifetime";

    private final Queue<ConnectedAction> waitingForConnection = new ArrayDeque<>();
    private BillingClient billingClient;
    private boolean connectionInFlight;
    private PluginCall purchaseCall;

    private interface ConnectedAction {
        void run(BillingResult setupResult);
    }

    @Override
    public void load() {
        billingClient = BillingClient.newBuilder(getContext())
                .setListener(this)
                .enablePendingPurchases(
                        PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .enableAutoServiceReconnection()
                .build();
    }

    @PluginMethod
    public void getRuntime(PluginCall call) {
        boolean debuggable = (getContext().getApplicationInfo().flags
                & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        JSObject result = new JSObject();
        put(result, "android", true);
        put(result, "debugBuild", debuggable);
        call.resolve(result);
    }

    @PluginMethod
    public void getProductDetails(PluginCall call) {
        String productId = call.getString("productId", PRODUCT_ID);
        if (!PRODUCT_ID.equals(productId)) {
            call.resolve(unavailable("This CoachAura build does not offer that product."));
            return;
        }
        withConnection(setup -> {
            if (!isReady(setup)) {
                call.resolve(unavailable("Google Play Billing is unavailable. Check that Play Store is available and this app or license-tester build is eligible."));
                return;
            }
            QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                    .setProductList(java.util.Collections.singletonList(
                            QueryProductDetailsParams.Product.newBuilder()
                                    .setProductId(PRODUCT_ID)
                                    .setProductType(BillingClient.ProductType.INAPP)
                                    .build()))
                    .build();
            billingClient.queryProductDetailsAsync(params, (result, detailsResult) -> {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK
                        || detailsResult == null) {
                    call.resolve(unavailable(billingMessage(result)));
                    return;
                }
                ProductDetails match = null;
                for (ProductDetails item : detailsResult.getProductDetailsList()) {
                    if (PRODUCT_ID.equals(item.getProductId())) {
                        match = item;
                        break;
                    }
                }
                if (match == null || match.getOneTimePurchaseOfferDetailsList() == null
                        || match.getOneTimePurchaseOfferDetailsList().isEmpty()) {
                    call.resolve(unavailable("The lifetime product is not active for this Play account yet."));
                    return;
                }
                ProductDetails.OneTimePurchaseOfferDetails offer =
                        match.getOneTimePurchaseOfferDetailsList().get(0);
                JSObject response = new JSObject();
                put(response, "available", true);
                put(response, "productId", PRODUCT_ID);
                put(response, "formattedPrice", offer.getFormattedPrice());
                put(response, "currency", offer.getPriceCurrencyCode());
                call.resolve(response);
            });
        });
    }

    @PluginMethod
    public void queryPurchases(PluginCall call) {
        withConnection(setup -> {
            if (!isReady(setup)) {
                call.resolve(unavailable("Google Play could not check purchases. Check Play Store availability and retry."));
                return;
            }
            queryOwnedPurchases((result, purchases) -> {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    call.resolve(unavailable(billingMessage(result)));
                    return;
                }
                JSArray records = new JSArray();
                for (Purchase purchase : purchases) {
                    if (!purchase.getProducts().contains(PRODUCT_ID)) continue;
                    String state = purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED
                            ? "PURCHASED"
                            : purchase.getPurchaseState() == Purchase.PurchaseState.PENDING
                            ? "PENDING"
                            : "CANCELLED";
                    JSObject record = new JSObject();
                    put(record, "productId", PRODUCT_ID);
                    put(record, "state", state);
                    put(record, "acknowledged", purchase.isAcknowledged());
                    append(records, record);
                    if (purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED
                            && !purchase.isAcknowledged()) {
                        acknowledge(purchase);
                    }
                }
                JSObject response = new JSObject();
                put(response, "available", true);
                put(response, "purchases", records);
                call.resolve(response);
            });
        });
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        String productId = call.getString("productId", PRODUCT_ID);
        if (!PRODUCT_ID.equals(productId)) {
            call.resolve(purchaseResult("error", "Unknown CoachAura product."));
            return;
        }
        if (purchaseCall != null) {
            call.resolve(purchaseResult("error", "A Google Play purchase is already in progress."));
            return;
        }
        withConnection(setup -> {
            if (!isReady(setup)) {
                call.resolve(purchaseResult("error", "Google Play Billing is unavailable. Check Play Store availability and the app or license-tester build, then retry."));
                return;
            }
            QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                    .setProductList(java.util.Collections.singletonList(
                            QueryProductDetailsParams.Product.newBuilder()
                                    .setProductId(PRODUCT_ID)
                                    .setProductType(BillingClient.ProductType.INAPP)
                                    .build()))
                    .build();
            billingClient.queryProductDetailsAsync(params, (result, detailsResult) -> {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK
                        || detailsResult == null) {
                    call.resolve(purchaseResult("error", billingMessage(result)));
                    return;
                }
                ProductDetails product = null;
                for (ProductDetails item : detailsResult.getProductDetailsList()) {
                    if (PRODUCT_ID.equals(item.getProductId())) {
                        product = item;
                        break;
                    }
                }
                if (product == null || product.getOneTimePurchaseOfferDetailsList() == null
                        || product.getOneTimePurchaseOfferDetailsList().isEmpty()) {
                    call.resolve(purchaseResult("error", "The lifetime product is not available in Google Play yet."));
                    return;
                }
                ProductDetails.OneTimePurchaseOfferDetails offer =
                        product.getOneTimePurchaseOfferDetailsList().get(0);
                BillingFlowParams.ProductDetailsParams productParams =
                        BillingFlowParams.ProductDetailsParams.newBuilder()
                                .setProductDetails(product)
                                .setOfferToken(offer.getOfferToken())
                                .build();
                BillingFlowParams flow = BillingFlowParams.newBuilder()
                        .setProductDetailsParamsList(java.util.Collections.singletonList(productParams))
                        .build();
                purchaseCall = call;
                BillingResult launch = billingClient.launchBillingFlow(getActivity(), flow);
                if (launch.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    purchaseCall = null;
                    String status = launch.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED
                            ? "cancelled" : "error";
                    call.resolve(purchaseResult(status, billingMessage(launch)));
                }
            });
        });
    }

    @Override
    public void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
        PluginCall pending = purchaseCall;
        if (pending == null) {
            queryOwnedPurchases((queryResult, owned) -> {
                if (queryResult.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    acknowledgeUnacknowledged(owned);
                }
                notifyListeners("purchaseUpdated", new JSObject());
            });
            return;
        }
        purchaseCall = null;
        if (result.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) {
            pending.resolve(purchaseResult("cancelled", "Purchase cancelled."));
            notifyListeners("purchaseUpdated", new JSObject());
            return;
        }
        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
            pending.resolve(purchaseResult("error", billingMessage(result)));
            return;
        }
        queryOwnedPurchases((queryResult, owned) -> {
            if (queryResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                pending.resolve(purchaseResult("error", "Google Play did not confirm ownership. Recheck purchases before trying again."));
                return;
            }
            acknowledgeUnacknowledged(owned);
            boolean purchased = false;
            boolean isPending = false;
            for (Purchase item : owned) {
                if (!item.getProducts().contains(PRODUCT_ID)) continue;
                purchased |= item.getPurchaseState() == Purchase.PurchaseState.PURCHASED;
                isPending |= item.getPurchaseState() == Purchase.PurchaseState.PENDING;
            }
            String state = purchased ? "purchased" : isPending ? "pending" : "error";
            String message = purchased ? "Google Play purchase confirmed."
                    : isPending ? "Payment is pending in Google Play."
                    : "Google Play has not confirmed ownership.";
            pending.resolve(purchaseResult(state, message));
            notifyListeners("purchaseUpdated", new JSObject());
        });
    }

    private void withConnection(ConnectedAction action) {
        if (billingClient == null) {
            action.run(null);
            return;
        }
        synchronized (waitingForConnection) {
            if (billingClient.isReady()) {
                action.run(null);
                return;
            }
            waitingForConnection.add(action);
            if (connectionInFlight) return;
            connectionInFlight = true;
        }
        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult result) {
                List<ConnectedAction> ready = new ArrayList<>();
                synchronized (waitingForConnection) {
                    connectionInFlight = false;
                    while (!waitingForConnection.isEmpty()) ready.add(waitingForConnection.remove());
                }
                for (ConnectedAction task : ready) task.run(result);
            }

            @Override
            public void onBillingServiceDisconnected() {
                synchronized (waitingForConnection) {
                    connectionInFlight = false;
                }
            }
        });
    }

    private boolean isReady(BillingResult setup) {
        return billingClient != null && billingClient.isReady()
                && (setup == null || setup.getResponseCode() == BillingClient.BillingResponseCode.OK);
    }

    private interface PurchasesCallback {
        void complete(BillingResult result, List<Purchase> purchases);
    }

    private void queryOwnedPurchases(PurchasesCallback callback) {
        QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.INAPP)
                .build();
        billingClient.queryPurchasesAsync(params, (result, purchases) ->
                callback.complete(result, purchases == null ? new ArrayList<>() : purchases));
    }

    private void acknowledgeUnacknowledged(List<Purchase> purchases) {
        for (Purchase purchase : purchases) {
            if (purchase.getProducts().contains(PRODUCT_ID)
                    && purchase.getPurchaseState() == Purchase.PurchaseState.PURCHASED
                    && !purchase.isAcknowledged()) {
                acknowledge(purchase);
            }
        }
    }

    private void acknowledge(Purchase purchase) {
        AcknowledgePurchaseParams params = AcknowledgePurchaseParams.newBuilder()
                .setPurchaseToken(purchase.getPurchaseToken())
                .build();
        billingClient.acknowledgePurchase(params, result -> {
            JSObject event = new JSObject();
            put(event, "acknowledgement", result.getResponseCode() == BillingClient.BillingResponseCode.OK
                    ? "acknowledged" : "retry");
            notifyListeners("purchaseUpdated", event);
        });
    }

    private static JSObject unavailable(String message) {
        JSObject result = new JSObject();
        put(result, "available", false);
        put(result, "message", message);
        return result;
    }

    private static JSObject purchaseResult(String status, String message) {
        JSObject result = new JSObject();
        put(result, "status", status);
        put(result, "message", message == null ? "" : message);
        return result;
    }

    private static String billingMessage(BillingResult result) {
        if (result == null) return "Google Play Billing did not connect.";
        String detail = result.getDebugMessage();
        if (detail == null || detail.trim().isEmpty()) {
            return "Google Play Billing returned code " + result.getResponseCode() + ".";
        }
        return "Google Play Billing: " + detail;
    }

    private static void put(JSObject target, String key, Object value) {
        target.put(key, value);
    }

    private static void append(JSArray target, Object value) {
        target.put(value);
    }
}
