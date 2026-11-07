package com.megaradio.tv

/**
 * Single place to swap the production URL for staging. Kept outside
 * BuildConfig so we don't need a separate buildConfig block; dev and release
 * both hit the same CDN-cached TV bundle.
 */
object BuildConfigExtras {
    const val TV_WEB_URL = "https://cdn.themegaradio.com/"
    const val TV_ORIGIN = "https://cdn.themegaradio.com"
}
