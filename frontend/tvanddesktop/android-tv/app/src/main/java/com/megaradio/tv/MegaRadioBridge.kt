package com.megaradio.tv

import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.util.Log
import android.webkit.WebView
import com.megaradio.tv.channels.RecommendationsChannel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.cancel
import org.json.JSONArray
import org.json.JSONObject

/**
 * Native IAP bridge exposed to the WebView as `window.MegaRadioNative`.
 *
 * JS calls:
 *
 *     MegaRadioNative.invoke(JSON.stringify({ id, fn, args }))
 *
 * Kotlin replies (on UI thread) by evaluating:
 *
 *     window.MegaRadioBridge.__resolveIap(id, payload);
 *
 * The protocol is identical to the Apple TV (WKWebView) bridge so the
 * shared web bundle's `src/lib/nativeIap.ts` works unchanged on both.
 */
class MegaRadioNativeBridge(
    private val activity: Activity,
    private val webView: WebView,
    private val billing: BillingService,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    fun invoke(json: String) {
        val parsed = try { JSONObject(json) } catch (e: Exception) {
            Log.w(TAG, "invoke: invalid JSON"); return
        }
        val id = parsed.optString("id")
        val fn = parsed.optString("fn")
        val args = parsed.optJSONObject("args") ?: JSONObject()
        Log.d(TAG, "invoke fn=$fn id=$id")

        scope.launch {
            val payload: Any = try {
                when (fn) {
                    "getProducts" -> billing.getProducts()
                    "purchaseProduct" -> billing.purchase(activity, args.optString("productId"))
                    "restorePurchases" -> billing.restore()
                    "setAuthToken" -> {
                        billing.authToken = args.optString("token").takeIf { it.isNotBlank() }
                        JSONObject().put("ok", true)
                    }
                    "manageSubscriptions" -> {
                        openPlayStoreSubscriptions()
                        JSONObject().put("ok", true)
                    }
                    else -> JSONObject().put("error", "Unknown fn: $fn")
                }
            } catch (e: Exception) {
                JSONObject().put("error", (e.message ?: "Unknown error"))
            }
            resolve(id, payload)
        }
    }

    private fun openPlayStoreSubscriptions() {
        // Google Play's subscription website requires a browser that may not
        // exist on a TV. Keep the remote-controlled flow inside the app.
        AlertDialog.Builder(activity)
            .setTitle(R.string.manage_subscriptions)
            .setMessage(R.string.manage_subscriptions_instructions)
            .setPositiveButton(android.R.string.ok, null)
            .show()
    }

    private fun resolve(id: String, payload: Any) {
        val json = payload.toString()
        val safeId = JSONObject.quote(id)
        val js = "window.MegaRadioBridge && window.MegaRadioBridge.__resolveIap" +
                " && window.MegaRadioBridge.__resolveIap($safeId, $json);"
        webView.post {
            if (TvNavigationPolicy.isTrusted(webView.url)) webView.evaluateJavascript(js, null)
        }
    }

    companion object { private const val TAG = "MegaRadioNativeBridge" }
    fun close() { scope.cancel() }
}

/**
 * Existing JS-side interface name: `MegaRadioBridge`. Kept untouched so the
 * "Continue Listening" → Recommendations Channel pipeline keeps working.
 */
class MegaRadioBridge(private val ctx: Context) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    fun onContinueListening(json: String) {
        scope.launch { publish(json) }
    }

    private fun publish(json: String) {
        try {
            val arr = JSONArray(json)
            val items = (0 until arr.length()).map { i ->
                val o = arr.getJSONObject(i)
                RecommendationsChannel.RecItem(
                    id          = o.optString("id"),
                    title       = o.optString("name"),
                    description = o.optString("description").takeIf { it.isNotBlank() },
                    iconUrl     = o.optString("iconUrl"),
                    streamUrl   = o.optString("streamUrl"),
                )
            }.filter { it.id.isNotBlank() && it.title.isNotBlank() }
            RecommendationsChannel.publish(ctx, items)
            Log.d(TAG, "published ${items.size} continue-listening items to home screen")
        } catch (e: Exception) {
            Log.w(TAG, "onContinueListening parse failed: ${e.message}")
        }
    }

    companion object { private const val TAG = "MegaRadioBridge" }
    fun close() { scope.cancel() }
}
