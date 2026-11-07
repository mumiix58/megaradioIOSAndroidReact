package com.megaradio

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.os.Handler
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.concurrent.Executors
import org.json.JSONObject
import org.json.JSONTokener
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import android.os.Bundle
import android.support.v4.media.MediaBrowserCompat
import android.support.v4.media.MediaDescriptionCompat
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import android.util.Log
import androidx.media.MediaBrowserServiceCompat
import android.net.Uri
import org.json.JSONArray

class MegaRadioAutoService : MediaBrowserServiceCompat() {

    companion object {
        private const val TAG = "MegaRadioAuto"

        const val MEDIA_ROOT_ID = "megaradio_root"
        const val MEDIA_FAVORITES = "megaradio_favorites"
        const val MEDIA_RECENT = "megaradio_recent"
        const val MEDIA_POPULAR = "megaradio_popular"
        const val MEDIA_GENRES = "megaradio_genres"

        const val GENRE_POP = "genre_pop"
        const val GENRE_ROCK = "genre_rock"
        const val GENRE_JAZZ = "genre_jazz"
        const val GENRE_CLASSICAL = "genre_classical"
        const val GENRE_ELECTRONIC = "genre_electronic"
        const val GENRE_HIPHOP = "genre_hiphop"
        const val GENRE_TURKISH = "genre_turkish"
        const val GENRE_NEWS = "genre_news"

        const val ASYNC_STORAGE_FAVORITES_KEY = "megaradio_android_auto_favorites"

        // Content style hint keys (from MediaConstants)
        const val CONTENT_STYLE_BROWSABLE_HINT = "android.media.browse.CONTENT_STYLE_BROWSABLE_HINT"
        const val CONTENT_STYLE_PLAYABLE_HINT = "android.media.browse.CONTENT_STYLE_PLAYABLE_HINT"
        const val CONTENT_STYLE_SUPPORTED = "android.media.browse.CONTENT_STYLE_SUPPORTED"
        const val CONTENT_STYLE_LIST = 1
        const val CONTENT_STYLE_GRID = 2
    }

    private val handler = Handler(Looper.getMainLooper())
    private val catalogExecutor = Executors.newSingleThreadExecutor()
    private val preferences by lazy { getSharedPreferences("megaradio_auto", MODE_PRIVATE) }
    private var destroyed = false
    private var preparing = false
    private var resumeAfterFocus = false
    private var hasAudioFocus = false
    private var isForeground = false
    private var browseRevision = 0
    private val prepareTimeout = Runnable { failPlayback() }
    private val catalogListener = SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
        if (key == "catalog") handler.post {
            browseRevision++
            categoryStationsMap.clear()
            allStations.clear()
            currentCategoryStations = emptyList()
            currentStationIndex = -1
            listOf(MEDIA_ROOT_ID, MEDIA_FAVORITES, MEDIA_RECENT, MEDIA_POPULAR, MEDIA_GENRES).forEach { notifyChildrenChanged(it) }
        }
    }

    private var mediaSession: MediaSessionCompat? = null
    private var mediaPlayer: MediaPlayer? = null
    private var audioManager: AudioManager? = null
    private var audioFocusRequest: AudioFocusRequest? = null

    private var currentStation: StationInfo? = null
    private var currentCategoryStations: List<StationInfo> = emptyList()
    private var currentStationIndex: Int = -1

    private val allStations = mutableMapOf<String, StationInfo>()
    private val categoryStationsMap = mutableMapOf<String, List<StationInfo>>()

    // ── Lifecycle ────────────────────────────────────────────

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "MegaRadioAutoService created")
        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        preferences.registerOnSharedPreferenceChangeListener(catalogListener)
        initMediaSession()
    }

    override fun onDestroy() {
        Log.d(TAG, "MegaRadioAutoService destroyed")
        destroyed = true
        preferences.unregisterOnSharedPreferenceChangeListener(catalogListener)
        catalogExecutor.shutdownNow()
        handler.removeCallbacksAndMessages(null)
        stopPlayback()
        mediaSession?.release()
        mediaSession = null
        super.onDestroy()
    }

    // ── Station Data ────────────────────────────────────────

    private fun catalog(): JSONObject = try { JSONObject(preferences.getString("catalog", "{}") ?: "{}") } catch (_: Exception) { JSONObject() }
    private fun label(key: String, fallback: String) = catalog().optJSONObject("labels")?.optString(key)?.takeIf { it.isNotBlank() } ?: fallback

    private fun parseStations(array: JSONArray): List<StationInfo> = (0 until minOf(array.length(), 100)).mapNotNull { index ->
        val item = array.optJSONObject(index) ?: return@mapNotNull null
        fun field(vararg keys: String): String = keys.firstNotNullOfOrNull { key ->
            item.optString(key).takeIf { it.isNotBlank() && it != "null" }
        } ?: ""
        val id = field("id", "_id", "stationuuid")
        val name = field("name")
        val stream = field("streamUrl", "urlResolved", "url_resolved", "url")
        if (id.isBlank() || name.isBlank() || Uri.parse(stream).scheme !in listOf("http", "https")) null
        else StationInfo(id, name, field("country", "subtitle"), stream, field("favicon", "logoUrl"))
    }.distinctBy { it.id }

    private fun loadCached(key: String): List<StationInfo> = parseStations(catalog().optJSONArray(key) ?: JSONArray())

    // Only public station data is fetched. No account token is persisted in the car cache.
    private fun fetchArray(path: String, key: String): JSONArray {
        val connection = URL("https://api.themegaradio.com$path").openConnection() as HttpURLConnection
        connection.connectTimeout = 10_000
        connection.readTimeout = 15_000
        try {
            if (connection.responseCode !in 200..299) throw IllegalStateException("Catalog unavailable")
            val data = JSONTokener(connection.inputStream.bufferedReader().use { it.readText() }).nextValue()
            return when (data) {
                is JSONArray -> data
                is JSONObject -> data.optJSONArray(key) ?: data.optJSONArray("data") ?: JSONArray()
                else -> JSONArray()
            }
        } finally { connection.disconnect() }
    }

    // ── MediaSession ────────────────────────────────────────

    private fun initMediaSession() {
        try {
            mediaSession = MediaSessionCompat(this, "MegaRadioAutoSession").apply {
                setFlags(
                    MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS or
                    MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
                )
                setCallback(AutoSessionCallback())
                setPlaybackState(buildState(PlaybackStateCompat.STATE_NONE))
                isActive = true
            }
            sessionToken = mediaSession?.sessionToken
            Log.d(TAG, "MediaSession initialized with full callback")
        } catch (e: Exception) {
            Log.e(TAG, "Error initializing MediaSession", e)
        }
    }

    private fun buildState(state: Int, position: Long = 0L): PlaybackStateCompat {
        return PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY or
                PlaybackStateCompat.ACTION_PAUSE or
                PlaybackStateCompat.ACTION_PLAY_PAUSE or
                PlaybackStateCompat.ACTION_STOP or
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                PlaybackStateCompat.ACTION_PLAY_FROM_MEDIA_ID
            )
            .setState(state, position, 1.0f)
            .build()
    }

    private fun updateState(state: Int) {
        mediaSession?.setPlaybackState(buildState(state))
        if (isForeground) getSystemService(NotificationManager::class.java).notify(7401, notification(state == PlaybackStateCompat.STATE_PLAYING))
    }

    private fun updateMetadata(station: StationInfo) {
        mediaSession?.setMetadata(
            MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_MEDIA_ID, station.id)
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, station.name)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, station.subtitle)
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, "MegaRadio")
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, -1L)
                .build()
        )
    }

    // ── Audio Focus ─────────────────────────────────────────

    private val focusListener = AudioManager.OnAudioFocusChangeListener { change ->
        when (change) {
            AudioManager.AUDIOFOCUS_LOSS -> stopPlayback()
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
                hasAudioFocus = false
                resumeAfterFocus = preparing || mediaPlayer?.isPlaying == true
                if (!preparing) mediaPlayer?.takeIf { it.isPlaying }?.pause()
                updateState(PlaybackStateCompat.STATE_PAUSED)
            }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> mediaPlayer?.setVolume(0.2f, 0.2f)
            AudioManager.AUDIOFOCUS_GAIN -> {
                hasAudioFocus = true
                mediaPlayer?.setVolume(1f, 1f)
                if (resumeAfterFocus) {
                    resumeAfterFocus = false
                    if (!preparing) { mediaPlayer?.start(); updateState(PlaybackStateCompat.STATE_PLAYING) }
                }
            }
        }
    }

    private fun requestFocus(): Boolean {
        val result = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build()
                )
                .setOnAudioFocusChangeListener(focusListener)
                .build()
            audioFocusRequest = req
            audioManager?.requestAudioFocus(req)
        } else {
            @Suppress("DEPRECATION")
            audioManager?.requestAudioFocus(
                focusListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN
            )
        }
        hasAudioFocus = result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
        return hasAudioFocus
    }

    private fun releaseFocus() {
        hasAudioFocus = false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            audioFocusRequest?.let { audioManager?.abandonAudioFocusRequest(it) }
        } else {
            @Suppress("DEPRECATION")
            audioManager?.abandonAudioFocus(focusListener)
        }
    }

    // ── Playback ────────────────────────────────────────────

    private fun notification(playing: Boolean) = NotificationCompat.Builder(this, "megaradio_auto_playback")
        .setSmallIcon(R.drawable.ic_auto_icon)
        .setContentTitle(currentStation?.name ?: "MegaRadio")
        .setContentText(currentStation?.subtitle ?: "")
        .setContentIntent(packageManager.getLaunchIntentForPackage(packageName)?.let {
            PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        })
        .setOnlyAlertOnce(true).setSilent(true).setOngoing(playing)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setStyle(androidx.media.app.NotificationCompat.MediaStyle().setMediaSession(mediaSession?.sessionToken).setShowActionsInCompactView(0))
        .addAction(if (playing) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play,
            if (playing) "Pause" else "Play", PendingIntent.getService(this, 1,
                Intent(this, MegaRadioAutoService::class.java).setAction(if (playing) "pause" else "play"),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
        .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop", PendingIntent.getService(this, 2,
            Intent(this, MegaRadioAutoService::class.java).setAction("stop"), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
        .build()

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            "play" -> mediaSession?.controller?.transportControls?.play()
            "pause" -> mediaSession?.controller?.transportControls?.pause()
            "stop" -> stopPlayback()
        }
        return START_NOT_STICKY
    }

    private fun beginForeground(): Boolean = try {
        if (Build.VERSION.SDK_INT >= 26) getSystemService(NotificationManager::class.java).createNotificationChannel(
            NotificationChannel("megaradio_auto_playback", "MegaRadio", NotificationManager.IMPORTANCE_LOW))
        ContextCompat.startForegroundService(this, Intent(this, MegaRadioAutoService::class.java))
        startForeground(7401, notification(false))
        isForeground = true
        true
    } catch (_: Exception) { failPlayback(); false }

    private fun failPlayback() {
        stopPlayback()
        updateState(PlaybackStateCompat.STATE_ERROR)
    }

    private fun playStation(station: StationInfo) {
        stopPlayback()
        currentStation = station
        updateMetadata(station)
        if (!beginForeground() || !requestFocus()) { failPlayback(); return }
        try {
            preparing = true
            updateState(PlaybackStateCompat.STATE_BUFFERING)
            mediaPlayer = MediaPlayer().apply {
                setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
                setDataSource(station.streamUrl)
                setOnPreparedListener { player ->
                    if (mediaPlayer !== player) return@setOnPreparedListener
                    preparing = false
                    handler.removeCallbacks(prepareTimeout)
                    // A transient focus loss while buffering must not start audio over another app.
                    if (hasAudioFocus) { player.start(); updateState(PlaybackStateCompat.STATE_PLAYING) }
                }
                setOnErrorListener { _, _, _ -> failPlayback(); true }
                setOnCompletionListener { stopPlayback() }
                prepareAsync()
            }
            handler.postDelayed(prepareTimeout, 30_000)
        } catch (_: Exception) { failPlayback() }
    }

    private fun stopPlayback() {
        handler.removeCallbacks(prepareTimeout)
        preparing = false
        resumeAfterFocus = false
        val previous = mediaPlayer
        mediaPlayer = null
        try { previous?.release() } catch (_: Exception) { }
        releaseFocus()
        isForeground = false
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
        updateState(PlaybackStateCompat.STATE_STOPPED)
    }

    // ── MediaSession Callback ───────────────────────────────

    inner class AutoSessionCallback : MediaSessionCompat.Callback() {

        override fun onPlayFromMediaId(mediaId: String?, extras: Bundle?) {
            Log.d(TAG, "onPlayFromMediaId: $mediaId")
            if (mediaId.isNullOrEmpty() || mediaId == "no_fav") return

            // Find station in indexed map or in favorites
            val station = allStations[mediaId] ?: (loadCached("favorites") + loadCached("recent")).find { it.id == mediaId }
            if (station == null) {
                Log.w(TAG, "Station not found: $mediaId")
                return
            }

            // Resolve skip-next/prev context
            resolveCategory(mediaId)
            playStation(station)
        }

        override fun onPlay() {
            if (preparing) return
            if (mediaPlayer != null) {
                if (beginForeground() && requestFocus()) {
                    resumeAfterFocus = false
                    mediaPlayer?.start()
                    updateState(PlaybackStateCompat.STATE_PLAYING)
                }
            } else currentStation?.let { playStation(it) }
        }

        override fun onPause() {
            resumeAfterFocus = false
            if (preparing) stopPlayback()
            else {
                mediaPlayer?.takeIf { it.isPlaying }?.pause()
                releaseFocus()
                updateState(PlaybackStateCompat.STATE_PAUSED)
                stopForeground(STOP_FOREGROUND_DETACH)
                isForeground = false
            }
        }

        override fun onStop() {
            Log.d(TAG, "onStop")
            stopPlayback()
        }

        override fun onSkipToNext() {
            Log.d(TAG, "onSkipToNext")
            if (currentCategoryStations.isNotEmpty() && currentStationIndex >= 0) {
                currentStationIndex = (currentStationIndex + 1) % currentCategoryStations.size
                playStation(currentCategoryStations[currentStationIndex])
            }
        }

        override fun onSkipToPrevious() {
            Log.d(TAG, "onSkipToPrevious")
            if (currentCategoryStations.isNotEmpty() && currentStationIndex >= 0) {
                currentStationIndex = if (currentStationIndex > 0)
                    currentStationIndex - 1
                else
                    currentCategoryStations.size - 1
                playStation(currentCategoryStations[currentStationIndex])
            }
        }
    }

    private fun resolveCategory(mediaId: String) {
        // Check built-in categories
        for ((_, stations) in categoryStationsMap) {
            val idx = stations.indexOfFirst { it.id == mediaId }
            if (idx >= 0) {
                currentCategoryStations = stations
                currentStationIndex = idx
                return
            }
        }
        // Check favorites
        val favs = loadCached("favorites")
        val idx = favs.indexOfFirst { it.id == mediaId }
        if (idx >= 0) {
            currentCategoryStations = favs
            currentStationIndex = idx
        }
    }

    // ── Browse Tree ─────────────────────────────────────────

    override fun onGetRoot(
        clientPackageName: String,
        clientUid: Int,
        rootHints: Bundle?
    ): BrowserRoot? {
        val ownsPackage = packageManager.getPackagesForUid(clientUid)?.contains(clientPackageName) == true
        val trustedController = androidx.media.MediaSessionManager.getSessionManager(this).isTrustedForMediaControl(
            androidx.media.MediaSessionManager.RemoteUserInfo(clientPackageName, -1, clientUid))
        val googleCar = clientPackageName == "com.google.android.projection.gearhead" &&
            packageManager.checkSignatures(clientPackageName, "com.google.android.gms") == android.content.pm.PackageManager.SIGNATURE_MATCH
        if (!ownsPackage || (clientUid != applicationInfo.uid && !trustedController && !googleCar)) return null
        val extras = Bundle().apply {
            putBoolean(CONTENT_STYLE_SUPPORTED, true)
            putInt(CONTENT_STYLE_BROWSABLE_HINT, CONTENT_STYLE_GRID)
            putInt(CONTENT_STYLE_PLAYABLE_HINT, CONTENT_STYLE_LIST)
        }
        return BrowserRoot(MEDIA_ROOT_ID, extras)
    }

    override fun onLoadChildren(
        parentId: String,
        result: Result<MutableList<MediaBrowserCompat.MediaItem>>
    ) {
        if (parentId == MEDIA_ROOT_ID) {
            result.sendResult(mutableListOf(
                browsable(MEDIA_FAVORITES, label("favorites", "Favorites"), "", "ic_heart"),
                browsable(MEDIA_RECENT, label("recent", "Recently played"), "", "ic_clock"),
                browsable(MEDIA_POPULAR, label("popular", "Popular stations"), "", "ic_star"),
                browsable(MEDIA_GENRES, label("genres", "Genres"), "", "ic_music")
            ))
            return
        }
        if (parentId == MEDIA_FAVORITES || parentId == MEDIA_RECENT) {
            val stations = loadCached(if (parentId == MEDIA_FAVORITES) "favorites" else "recent")
            categoryStationsMap[parentId] = stations
            stations.forEach { allStations[it.id] = it }
            result.sendResult(stations.map { playable(it.id, it.name, it.subtitle, it.streamUrl, it.favicon) }.toMutableList())
            return
        }
        result.detach()
        val revision = browseRevision
        val country = catalog().optString("country", "")
        catalogExecutor.execute {
            try {
                if (parentId == MEDIA_GENRES) {
                    val genres = fetchArray("/api/genres", "genres")
                    val items = (0 until minOf(genres.length(), 100)).mapNotNull { i ->
                        val genre = genres.optJSONObject(i) ?: return@mapNotNull null
                        val slug = genre.optString("slug")
                        if (slug.isBlank()) null else browsable("genre_$slug", genre.optString("name", slug), "", "ic_music")
                    }.toMutableList()
                    handler.post { if (!destroyed) result.sendResult(if (revision == browseRevision) items else mutableListOf()) }
                } else {
                    val path = when {
                        parentId == MEDIA_POPULAR -> "/api/stations/popular?limit=50&excludeBroken=true&country=" + URLEncoder.encode(country, "UTF-8")
                        parentId.startsWith("genre_") -> "/api/genres/" + URLEncoder.encode(parentId.removePrefix("genre_"), "UTF-8") + "/stations?limit=50&excludeBroken=true"
                        else -> { handler.post { if (!destroyed) result.sendResult(mutableListOf()) }; return@execute }
                    }
                    val stations = parseStations(fetchArray(path, "stations"))
                    handler.post {
                        if (!destroyed) {
                            if (revision == browseRevision) {
                                categoryStationsMap[parentId] = stations
                                stations.forEach { allStations[it.id] = it }
                                result.sendResult(stations.map { playable(it.id, it.name, it.subtitle, it.streamUrl, it.favicon) }.toMutableList())
                            } else result.sendResult(mutableListOf())
                        }
                    }
                }
            } catch (_: Exception) { handler.post { if (!destroyed) result.sendError(Bundle()) } }
        }
    }

    // ── MediaItem Builders ──────────────────────────────────

    private fun browsable(id: String, title: String, sub: String, iconRes: String = ""): MediaBrowserCompat.MediaItem {
        val descBuilder = MediaDescriptionCompat.Builder()
            .setMediaId(id)
            .setTitle(title)
            .setSubtitle(sub)
        if (iconRes.isNotEmpty()) {
            descBuilder.setIconUri(Uri.parse("android.resource://com.megaradio/drawable/$iconRes"))
        }
        return MediaBrowserCompat.MediaItem(descBuilder.build(), MediaBrowserCompat.MediaItem.FLAG_BROWSABLE)
    }

    private fun playable(id: String, title: String, sub: String, url: String, icon: String = ""): MediaBrowserCompat.MediaItem {
        val extras = Bundle().apply { putString("stream_url", url) }
        val descBuilder = MediaDescriptionCompat.Builder()
            .setMediaId(id)
            .setTitle(title)
            .setSubtitle(sub)
            .setMediaUri(Uri.parse(url))
            .setExtras(extras)
        if (icon.isNotEmpty()) {
            descBuilder.setIconUri(Uri.parse(icon))
        }
        return MediaBrowserCompat.MediaItem(descBuilder.build(), MediaBrowserCompat.MediaItem.FLAG_PLAYABLE)
    }

    // ── Data Class ──────────────────────────────────────────

    data class StationInfo(
        val id: String,
        val name: String,
        val subtitle: String,
        val streamUrl: String,
        val favicon: String = ""
    )
}
