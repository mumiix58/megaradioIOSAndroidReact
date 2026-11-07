package com.megaradio.tv

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TvNavigationPolicyTest {
    @Test fun permitsTheCdnAndAppRoutes() {
        assertTrue(TvNavigationPolicy.isTrusted(BuildConfigExtras.TV_WEB_URL))
        assertTrue(TvNavigationPolicy.isTrusted("https://cdn.themegaradio.com/#/radio-playing?station=123"))
        assertTrue(TvNavigationPolicy.isTrusted("https://cdn.themegaradio.com:443/"))
    }

    @Test fun rejectsOtherOriginsAndMisleadingUrls() {
        listOf(null, "", "not a URL", "http://cdn.themegaradio.com/",
            "https://themegaradio.com/tv", "https://cdn.themegaradio.com.evil.example/",
            "https://cdn.themegaradio.com@evil.example/", "https://evil.example@cdn.themegaradio.com/",
            "https://cdn.themegaradio.com:8443/", "javascript:alert(1)", "file:///index.html")
            .forEach { assertFalse("Must reject $it", TvNavigationPolicy.isTrusted(it)) }
    }
}
