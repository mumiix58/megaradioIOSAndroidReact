package com.megaradio.tv.channels

import android.content.ContentValues
import android.os.Build
import android.media.tv.TvContract
import android.content.ContentUris
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.tvprovider.media.tv.Channel
import androidx.tvprovider.media.tv.ChannelLogoUtils
import androidx.tvprovider.media.tv.TvContractCompat
import com.megaradio.tv.R

/**
 * Publishes a MegaRadio "Continue Listening" Recommendations Channel onto the
 * Android TV home screen. Called once from `MainActivity.onCreate()` the first
 * time the app starts, and again each time the JS layer posts a
 * `CONTINUE_LISTENING_CHANGED` message into the `MegaRadioBridge` interface.
 *
 * Data comes from the WebView via the JS bridge — no duplicated persistence.
 */
object RecommendationsChannel {

    data class RecItem(
        val id: String,
        val title: String,
        val description: String?,
        val iconUrl: String,
        val streamUrl: String,
    )

    fun publish(context: Context, stations: List<RecItem>) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        if (!context.packageManager.hasSystemFeature(android.content.pm.PackageManager.FEATURE_LEANBACK)) return
        val channelId = ensureChannel(context)
        // TV providers reject SQL selections. Enumerate this channel's rows and
        // remove each by its item URI, leaving other channels untouched.
        context.contentResolver.query(
            TvContract.buildPreviewProgramsUriForChannel(channelId),
            arrayOf(TvContract.PreviewPrograms._ID), null, null, null,
        )?.use { rows ->
            while (rows.moveToNext()) {
                context.contentResolver.delete(
                    TvContract.buildPreviewProgramUri(rows.getLong(0)), null, null,
                )
            }
        }
        stations.take(10).forEach { s ->
            val target = Intent(Intent.ACTION_VIEW,
                Uri.parse("megaradio://play").buildUpon().appendQueryParameter("station", s.id).build())
                .setPackage(context.packageName)
            // Public provider columns avoid inherited @RestrictTo builder APIs.
            val values = ContentValues().apply {
                put(TvContract.PreviewPrograms.COLUMN_CHANNEL_ID, channelId)
                put(TvContract.PreviewPrograms.COLUMN_TYPE, TvContract.PreviewPrograms.TYPE_STATION)
                put(TvContract.PreviewPrograms.COLUMN_TITLE, s.title)
                put(TvContract.PreviewPrograms.COLUMN_SHORT_DESCRIPTION, s.description ?: "")
                put(TvContract.PreviewPrograms.COLUMN_POSTER_ART_URI, s.iconUrl)
                put(TvContract.PreviewPrograms.COLUMN_POSTER_ART_ASPECT_RATIO,
                    TvContract.PreviewPrograms.ASPECT_RATIO_1_1)
                put(TvContract.PreviewPrograms.COLUMN_INTENT_URI, target.toUri(Intent.URI_INTENT_SCHEME))
                put(TvContract.PreviewPrograms.COLUMN_INTERNAL_PROVIDER_ID, s.id)
            }
            context.contentResolver.insert(TvContract.PreviewPrograms.CONTENT_URI, values)
        }
    }

    private fun ensureChannel(context: Context): Long {
        val existing = context.contentResolver.query(
            TvContractCompat.Channels.CONTENT_URI,
            arrayOf(TvContractCompat.Channels._ID, TvContractCompat.Channels.COLUMN_INTERNAL_PROVIDER_ID),
            null, null, null,
        )
        existing?.use {
            val idxId = it.getColumnIndex(TvContractCompat.Channels._ID)
            val idxProv = it.getColumnIndex(TvContractCompat.Channels.COLUMN_INTERNAL_PROVIDER_ID)
            while (it.moveToNext()) {
                if (it.getString(idxProv) == "continue_listening_v1") return it.getLong(idxId)
            }
        }
        val channel = Channel.Builder()
            .setType(TvContractCompat.Channels.TYPE_PREVIEW)
            .setDisplayName("Continue Listening")
            .setAppLinkIntentUri(Uri.parse("megaradio://home"))
            .setInternalProviderId("continue_listening_v1")
            .build()
        val uri = context.contentResolver.insert(TvContractCompat.Channels.CONTENT_URI, channel.toContentValues())
            ?: error("Failed to create channel")
        val channelId = ContentUris.parseId(uri)
        ChannelLogoUtils.storeChannelLogo(context, channelId, android.graphics.BitmapFactory.decodeResource(context.resources, R.mipmap.ic_launcher))
        TvContractCompat.requestChannelBrowsable(context, channelId)
        return channelId
    }
}
