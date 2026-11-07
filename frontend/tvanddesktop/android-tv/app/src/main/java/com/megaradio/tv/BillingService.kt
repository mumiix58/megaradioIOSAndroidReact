package com.megaradio.tv

import android.app.Activity
import android.content.Context
import android.util.Log
import com.android.billingclient.api.*
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlin.coroutines.resume
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Google Play Billing v8 wrapper.
 *
 * Mirrors `/app/frontend/src/services/iapService.ts` (mobile RN app) so the
 * same backend endpoint validates both flows:
 *
 *   POST https://api.themegaradio.com/api/user/subscription
 *
 * The bridge layer (`MegaRadioBridge.invoke(...)`) calls these methods and
 * marshals the result back to JS.
 */
class BillingService(private val context: Context) : PurchasesUpdatedListener {

    companion object {
        private const val TAG = "BillingService"
        private val SUB_PRODUCT_IDS = listOf(
            "megaradio_premium_yearly",
            "megaradio_premium_monthly1",
            "megaradio_remove_ads_yearly1",
        )
        private val INAPP_PRODUCT_IDS = listOf(
            "megaradio_premium_lifetime",
        )
        private val ALL_IDS = SUB_PRODUCT_IDS + INAPP_PRODUCT_IDS

        private const val API_BASE = "https://api.themegaradio.com"
    }

    /** JWT from the Account-Linking flow. Set via `setAuthToken` JS call. */
    @Volatile var authToken: String? = null

    private val billingClient: BillingClient = BillingClient.newBuilder(context)
        .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
        .enableAutoServiceReconnection()
        .setListener(this)
        .build()

    /** Pending purchase awaitable, completed by [onPurchasesUpdated]. */
    private var pendingPurchase: CompletableDeferred<JSONObject>? = null
    private var pendingProductId: String? = null
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val connectionMutex = Mutex()
    private val purchaseMutex = Mutex()

    suspend fun connect(): Boolean = connectionMutex.withLock {
        if (billingClient.isReady) return@withLock true
        withTimeout(15000) {
            suspendCancellableCoroutine { cont ->
                billingClient.startConnection(object : BillingClientStateListener {
                    override fun onBillingSetupFinished(result: BillingResult) {
                        if (cont.isActive) cont.resume(result.responseCode == BillingClient.BillingResponseCode.OK)
                    }
                    override fun onBillingServiceDisconnected() {
                        if (cont.isActive) cont.resume(false)
                    }
                })
            }
        }
    }

    suspend fun getProducts(): JSONArray {
        if (!connect()) return JSONArray()
        val subParams = QueryProductDetailsParams.newBuilder()
            .setProductList(SUB_PRODUCT_IDS.map {
                QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(it)
                    .setProductType(BillingClient.ProductType.SUBS)
                    .build()
            }).build()
        val inappParams = QueryProductDetailsParams.newBuilder()
            .setProductList(INAPP_PRODUCT_IDS.map {
                QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(it)
                    .setProductType(BillingClient.ProductType.INAPP)
                    .build()
            }).build()

        val subs = queryProductDetails(subParams)
        val inapps = queryProductDetails(inappParams)

        val arr = JSONArray()
        (subs + inapps).forEach { p ->
            val o = JSONObject()
            o.put("productId", p.productId)
            o.put("title", p.title.replace(" (MegaRadio)", ""))
            o.put("description", p.description)
            // Subs vs one-time price extraction
            val sub = p.subscriptionOfferDetails?.firstOrNull()?.pricingPhases?.pricingPhaseList?.firstOrNull()
            val oneTime = p.oneTimePurchaseOfferDetails
            if (sub != null) {
                o.put("localizedPrice", sub.formattedPrice)
                o.put("currency", sub.priceCurrencyCode)
                o.put("type", "subscription")
                o.put("billingPeriod", sub.billingPeriod)  // "P1M" | "P1Y"
            } else if (oneTime != null) {
                o.put("localizedPrice", oneTime.formattedPrice)
                o.put("currency", oneTime.priceCurrencyCode)
                o.put("type", "one-time")
                o.put("billingPeriod", "")
            }
            arr.put(o)
        }
        return arr
    }

    private suspend fun queryProductDetails(params: QueryProductDetailsParams): List<ProductDetails> =
        withTimeout(15000) { suspendCancellableCoroutine { cont ->
            billingClient.queryProductDetailsAsync(params) { result, detailsResult ->
                if (cont.isActive) {
                    if (result.responseCode == BillingClient.BillingResponseCode.OK) cont.resume(detailsResult.productDetailsList)
                    else cont.resumeWith(Result.failure(IllegalStateException(result.debugMessage)))
                }
            }
        } }

    suspend fun purchase(activity: Activity, productId: String): JSONObject {
        check(!authToken.isNullOrBlank()) { "Sign in before purchasing" }
        require(ALL_IDS.contains(productId)) { "Unknown product" }
        if (!purchaseMutex.tryLock()) return JSONObject().put("ok", false).put("error", "Purchase already in progress")
        try {
            return withTimeout(110000) { purchaseLocked(activity, productId) }
        } finally {
            pendingPurchase?.cancel()
            pendingPurchase = null
            pendingProductId = null
            purchaseMutex.unlock()
        }
    }

    private suspend fun purchaseLocked(activity: Activity, productId: String): JSONObject {
        if (!connect()) return JSONObject().put("ok", false).put("error", "Billing service unavailable")

        val type = if (INAPP_PRODUCT_IDS.contains(productId))
            BillingClient.ProductType.INAPP else BillingClient.ProductType.SUBS

        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(listOf(
                QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(productId)
                    .setProductType(type)
                    .build()
            )).build()
        val details = queryProductDetails(params).firstOrNull()
            ?: return JSONObject().put("ok", false).put("error", "Product not found")

        val productParams = BillingFlowParams.ProductDetailsParams.newBuilder()
            .setProductDetails(details)
            .also { b ->
                if (type == BillingClient.ProductType.SUBS) {
                    val token = details.subscriptionOfferDetails?.firstOrNull()?.offerToken
                    if (token != null) b.setOfferToken(token)
                }
            }
            .build()
        val flowParams = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(listOf(productParams))
            .build()

        val deferred = CompletableDeferred<JSONObject>()
        pendingPurchase = deferred
        pendingProductId = productId

        val launch = billingClient.launchBillingFlow(activity, flowParams)
        if (launch.responseCode != BillingClient.BillingResponseCode.OK) {
            pendingPurchase = null
            return JSONObject().put("ok", false).put("error", "Launch failed: ${launch.debugMessage}")
        }
        return deferred.await()
    }

    override fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) {
        val deferred = pendingPurchase ?: return
        val productId = pendingProductId ?: ""
        pendingPurchase = null
        pendingProductId = null

        when (result.responseCode) {
            BillingClient.BillingResponseCode.OK -> {
                val purchase = purchases?.firstOrNull { it.products.contains(productId) }
                if (purchase?.purchaseState == Purchase.PurchaseState.PURCHASED) {
                    // Return from Billing's main-thread callback immediately.
                    scope.launch {
                        try {
                            val plan = postReceiptToBackend(productId, purchase)
                            acknowledgeIfNeeded(purchase)
                            deferred.complete(JSONObject().put("ok", true)
                                .put("productId", productId).put("plan", plan))
                        } catch (error: Exception) {
                            deferred.completeExceptionally(error)
                        }
                    }
                } else {
                    deferred.complete(JSONObject().put("ok", false).put("error",
                        if (purchase?.purchaseState == Purchase.PurchaseState.PENDING) "Purchase pending approval" else "No completed purchase returned"))
                }
            }
            BillingClient.BillingResponseCode.USER_CANCELED ->
                deferred.complete(JSONObject().put("ok", false).put("error", "User cancelled"))
            else ->
                deferred.complete(JSONObject().put("ok", false)
                    .put("error", "Billing error ${result.responseCode}: ${result.debugMessage}"))
        }
    }

    private suspend fun acknowledgeIfNeeded(purchase: Purchase) {
        if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED && !purchase.isAcknowledged) {
            val params = AcknowledgePurchaseParams.newBuilder()
                .setPurchaseToken(purchase.purchaseToken).build()
            withTimeout(15000) { suspendCancellableCoroutine<Unit> { cont ->
                billingClient.acknowledgePurchase(params) { result ->
                    if (cont.isActive) {
                        if (result.responseCode == BillingClient.BillingResponseCode.OK) cont.resume(Unit)
                        else cont.resumeWith(Result.failure(IllegalStateException("Purchase acknowledgement failed")))
                    }
                }
            } }
        }
    }

    suspend fun restore(): JSONObject {
        check(!authToken.isNullOrBlank()) { "Sign in before restoring purchases" }
        if (!connect()) return JSONObject().put("ok", false).put("error", "Billing service unavailable")
        val subsQuery = QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.SUBS).build()
        val inappQuery = QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.INAPP).build()

        val subs = queryPurchases(subsQuery)
        val inapps = queryPurchases(inappQuery)
        val purchase = (subs + inapps).firstOrNull {
            it.purchaseState == Purchase.PurchaseState.PURCHASED
        } ?: return JSONObject().put("ok", false).put("error", "No purchases found")

        val productId = purchase.products.firstOrNull() ?: ""
        val plan = postReceiptToBackend(productId, purchase)
        acknowledgeIfNeeded(purchase)
        return JSONObject().apply {
            put("ok", true)
            put("productId", productId)
            put("plan", plan)
        }
    }

    private suspend fun queryPurchases(params: QueryPurchasesParams): List<Purchase> =
        withTimeout(15000) { suspendCancellableCoroutine { cont ->
            billingClient.queryPurchasesAsync(params) { result, list ->
                if (cont.isActive) {
                    if (result.responseCode == BillingClient.BillingResponseCode.OK) cont.resume(list)
                    else cont.resumeWith(Result.failure(IllegalStateException(result.debugMessage)))
                }
            }
        } }

    /**
     * POST receipt to backend. Mirrors mobile iapService.ts reportToBackend.
     * Runs off the UI thread. No local entitlement fallback on verification errors.
     */
    private suspend fun postReceiptToBackend(productId: String, purchase: Purchase): String {
        val token = authToken?.takeIf { it.isNotBlank() }
            ?: throw IllegalStateException("Sign in to verify your purchase")
        val plan = withContext(Dispatchers.IO) {
            val url = URL("$API_BASE/api/user/subscription")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Authorization", "Bearer $token")
                connectTimeout = 8000
                readTimeout = 8000
            }
            try {
            val body = JSONObject().apply {
                put("platform", "android")
                put("productId", productId)
                put("transactionId", purchase.orderId ?: purchase.purchaseToken)
                put("originalTransactionId", purchase.orderId ?: purchase.purchaseToken)
                put("isTrial", false)
                put("purchaseToken", purchase.purchaseToken)
            }
            conn.outputStream.use { it.write(body.toString().toByteArray()) }
            check(conn.responseCode in 200..299) { "Purchase verification failed (HTTP ${conn.responseCode})" }
            val responseText = conn.inputStream.bufferedReader().use { it.readText() }
            val obj = JSONObject(responseText)
            check(obj.optBoolean("success", true) && (obj.isNull("error") || obj.optString("error").isBlank())) {
                "Purchase verification rejected"
            }
            (obj.opt("plan") as? String)?.takeIf { it.isNotBlank() }
                ?: throw IllegalStateException("No verified subscription returned")
            } finally { conn.disconnect() }
        }
        check(authToken == token) { "Account changed while verifying purchase" }
        return plan
    }

    fun close() {
        pendingPurchase?.cancel()
        scope.cancel()
        billingClient.endConnection()
    }
}
