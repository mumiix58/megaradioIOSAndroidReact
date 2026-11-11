package com.megaradio.tv

import android.annotation.SuppressLint
import android.app.Activity
import android.app.SearchManager
import android.content.Intent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.IntentFilter
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.widget.TextView
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.view.WindowCompat
import androidx.core.content.ContextCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

/**
 * MegaRadio Android TV / Google TV / Fire TV shell.
 *
 * A full-screen WebView hosting the shared TV web bundle. The same JS engine
 * that runs on Samsung Tizen and webOS handles spatial navigation
 * and audio playback — we only need to funnel hardware remote events through
 * so the existing tv-remote-keys.js handler can dispatch them.
 */
class MainActivity : Activity() {

    private val desktopShell by lazy {
        packageManager.getActivityInfo(componentName, android.content.pm.PackageManager.GET_META_DATA)
            .metaData?.getBoolean("com.megaradio.DESKTOP_SHELL", false) == true
    }

    private lateinit var webView: WebView
    private val billingService by lazy { BillingService(this) }
    private var nativeBridge: MegaRadioNativeBridge? = null
    private var recommendationsBridge: MegaRadioBridge? = null
    private var playbackStarted = false
    private var controlsRegistered = false
    private val playbackControls = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val command = intent?.getStringExtra("command") ?: return
            if (command in setOf("resume", "pause", "stop") && ::webView.isInitialized) {
                webView.evaluateJavascript(TvRemoteCommands.script(command), null)
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Desktop keeps the system caption/taskbar and remains freely resizable.
        WindowCompat.setDecorFitsSystemWindows(window, desktopShell)
        if (!desktopShell) {
            WindowInsetsControllerCompat(window, window.decorView).apply {
                hide(WindowInsetsCompat.Type.systemBars())
                systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        }
        // Audio-only TV apps must allow Ambient Mode.

        // Origin-scoped messaging and document-start injection prevent another
        // website or an embedded frame from calling the native billing API.
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) ||
            !WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            setContentView(TextView(this).apply {
                text = getString(R.string.webview_update_required)
                setTextColor(Color.WHITE)
                setBackgroundColor(Color.parseColor("#0E0E0E"))
                textSize = 22f
                gravity = android.view.Gravity.CENTER
                setPadding(48, 48, 48, 48)
            })
            return
        }

        webView = WebView(this).apply {
            setBackgroundColor(Color.parseColor("#0E0E0E"))
            isFocusable = true
            isFocusableInTouchMode = true
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                mediaPlaybackRequiresUserGesture = false
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                cacheMode = WebSettings.LOAD_DEFAULT
                loadWithOverviewMode = true
                useWideViewPort = true
                allowFileAccess = false
                allowContentAccess = false
                userAgentString = "$userAgentString " +
                    if (desktopShell) "MegaRadioAndroidDesktop/1.0" else "MegaRadioAndroidTV/1.0"
            }
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                    val uri = request?.url ?: return true
                    if (TvNavigationPolicy.isTrusted(uri.toString())) return false
                    if (request.isForMainFrame && uri.scheme in listOf("https", "http")) {
                        showWebContent(uri)
                    }
                    return true
                }

                @Deprecated("Used by older Android framework versions")
                override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean =
                    !TvNavigationPolicy.isTrusted(url)

                override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                    super.onPageStarted(view, url, favicon)
                    if (!TvNavigationPolicy.isTrusted(url)) view?.stopLoading()
                }
            }
            webChromeClient = WebChromeClient()
            val recommendations = MegaRadioBridge(this@MainActivity)
            recommendationsBridge = recommendations
            val purchases = MegaRadioNativeBridge(this@MainActivity, this, billingService)
            nativeBridge = purchases
            val allowedOrigins = setOf(BuildConfigExtras.TV_ORIGIN)
            WebViewCompat.addWebMessageListener(this, "MegaRadioNativeTransport", allowedOrigins) {
                    _, message, sourceOrigin, isMainFrame, _ ->
                if (isMainFrame && TvNavigationPolicy.isTrusted(sourceOrigin.toString())) {
                    message.data?.let(purchases::invoke)
                }
            }
            WebViewCompat.addWebMessageListener(this, "MegaRadioRecommendationsTransport", allowedOrigins) {
                    _, message, sourceOrigin, isMainFrame, _ ->
                if (isMainFrame && TvNavigationPolicy.isTrusted(sourceOrigin.toString())) {
                    message.data?.let(recommendations::onContinueListening)
                }
            }
            WebViewCompat.addWebMessageListener(this, "MegaRadioPlaybackTransport", allowedOrigins) {
                    _, message, sourceOrigin, isMainFrame, _ ->
                if (isMainFrame && TvNavigationPolicy.isTrusted(sourceOrigin.toString())) {
                    message.data?.let { payload ->
                        val state = try { org.json.JSONObject(payload) } catch (_: Exception) { null }
                        if (state != null && state.optBoolean("hasStation")) {
                            if (state.optBoolean("playing") || playbackStarted) {
                                ContextCompat.startForegroundService(this@MainActivity,
                                    Intent(this@MainActivity, TvPlaybackService::class.java).putExtra("state", payload))
                                playbackStarted = true
                            }
                        } else if (playbackStarted) {
                            stopService(Intent(this@MainActivity, TvPlaybackService::class.java))
                            playbackStarted = false
                        }
                    }
                }
            }
            // Preserve the existing CDN protocol without exposing a Java object
            // to every frame. Installed before the shared app's first script.
            WebViewCompat.addDocumentStartJavaScript(this, """
                if (window === window.top) {
                    window.MegaRadioPlatform = { platform: 'androidtv' };
                    // Observe the existing CDN player without a Samsung/LG deployment.
                    var lastPlaybackState = '';
                    setInterval(function () {
                        var p = window.globalPlayer;
                        var state = JSON.stringify({hasStation: !!(p && p.currentStation),
                            playing: !!(p && p.isPlaying),
                            title: p && p.currentStation ? p.currentStation.name : 'MegaRadio'});
                        if (state !== lastPlaybackState) {
                            lastPlaybackState = state;
                            window.MegaRadioPlaybackTransport.postMessage(state);
                        }
                    }, 1000);
                    window.MegaRadioNative = {
                        platform: 'androidtv',
                        invoke: function (payload) { window.MegaRadioNativeTransport.postMessage(payload); }
                    };
                    window.MegaRadioBridge = {
                        onContinueListening: function (payload) {
                            window.MegaRadioRecommendationsTransport.postMessage(payload);
                        }
                    };
                }
            """.trimIndent(), allowedOrigins)
            if (!desktopShell) systemUiVisibility = View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_FULLSCREEN
            loadUrl(intentToUrl(intent) ?: BuildConfigExtras.TV_WEB_URL)
        }

        setContentView(webView)
        webView.requestFocus()
        ContextCompat.registerReceiver(this, playbackControls, IntentFilter(TvPlaybackService.ACTION_CONTROL),
            ContextCompat.RECEIVER_NOT_EXPORTED)
        controlsRegistered = true
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // Hot-route Assistant SEARCH / deep-links without recreating the WebView.
        if (::webView.isInitialized) intentToUrl(intent)?.let { webView.loadUrl(it) }
    }

    /**
     * Converts the incoming intent into a deep-link URL that the web layer's
     * `window.__MR_HANDLE_DEEP_LINK__` helper already knows how to open.
     *
     *   SEARCH(jazz)                → https://…/tv#/search?q=jazz
     *   VIEW megaradio://play?…     → https://…/tv#/radio-playing?station=<id>
     *   VIEW megaradio://genre/jazz → https://…/tv#/genre-list/jazz
     */
    private fun intentToUrl(intent: Intent?): String? {
        if (intent == null) return null
        val base = BuildConfigExtras.TV_WEB_URL.removeSuffix("/")
        return when (intent.action) {
            Intent.ACTION_SEARCH -> {
                val q = intent.getStringExtra(SearchManager.QUERY).orEmpty()
                if (q.isBlank()) null else "$base#/search?q=${Uri.encode(q)}"
            }
            Intent.ACTION_VIEW -> {
                val data = intent.data ?: return null
                if (data.scheme != "megaradio") return null
                when (data.host) {
                    "player" -> "$base#/radio-playing"
                    "play"   -> data.getQueryParameter("station")?.takeIf { it.isNotBlank() }
                        ?.let { "$base#/radio-playing?station=${Uri.encode(it)}" }
                    "genre"  -> data.pathSegments.firstOrNull()?.takeIf { it.isNotBlank() }
                        ?.let { "$base#/genre-list/${Uri.encode(it)}" }
                    "home"   -> base
                    "search" -> data.getQueryParameter("q")?.let { "$base#/search?q=${Uri.encode(it)}" }
                    else     -> null
                }
            }
            else -> null
        }
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (::webView.isInitialized) {
            val command = TvRemoteCommands.playerCommand(event.keyCode)
            if (command != null) {
                if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) {
                    webView.evaluateJavascript(TvRemoteCommands.script(command), null)
                }
                return true
            }
            if (event.keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
                if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) webView.goBack()
                return true
            }
        }
        return super.dispatchKeyEvent(event)
    }

    /** TV devices cannot rely on an external web browser. No native bridge here. */
    private fun showWebContent(uri: Uri) {
        val content = WebView(this).apply {
            settings.javaScriptEnabled = false
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean =
                    request?.url?.scheme != "https"
            }
            if (uri.scheme == "https") loadUrl(uri.toString())
        }
        android.app.AlertDialog.Builder(this).setView(content)
            .setPositiveButton(android.R.string.ok, null).create().apply {
                setOnDismissListener { content.destroy() }
                show()
                window?.setLayout(android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                    android.view.ViewGroup.LayoutParams.MATCH_PARENT)
            }
    }

    override fun onPause() {
        super.onPause()
        // Keep audio playing in the background by NOT pausing the WebView.
        // onPause() would stop media playback.
    }

    override fun onDestroy() {
        if (controlsRegistered) unregisterReceiver(playbackControls)
        stopService(Intent(this, TvPlaybackService::class.java))
        nativeBridge?.close()
        recommendationsBridge?.close()
        billingService.close()
        if (::webView.isInitialized) webView.destroy()
        super.onDestroy()
    }
}
