package com.megaradio.tv

import java.net.URI

/** Only the shared HTTPS TV application can access the native purchase bridge. */
object TvNavigationPolicy {
    fun isTrusted(url: String?): Boolean = try {
        val uri = URI(url ?: "")
        uri.scheme.equals("https", ignoreCase = true) &&
            uri.host.equals("cdn.themegaradio.com", ignoreCase = true) &&
            uri.userInfo == null && (uri.port == -1 || uri.port == 443)
    } catch (_: Exception) {
        false
    }
}
