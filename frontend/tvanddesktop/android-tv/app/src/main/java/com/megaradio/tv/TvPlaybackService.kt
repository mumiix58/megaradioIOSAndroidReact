package com.megaradio.tv

import android.app.*
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.BitmapFactory
import android.media.MediaMetadata
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.net.Uri
import android.os.Build
import android.os.IBinder
import org.json.JSONObject

/** Owns Android TV's Now Playing card while the shared WebView plays audio. */
class TvPlaybackService : Service() {
    private lateinit var session: MediaSession

    override fun onCreate() {
        super.onCreate()
        if (Build.VERSION.SDK_INT >= 26) {
            getSystemService(NotificationManager::class.java).createNotificationChannel(
                NotificationChannel(CHANNEL, "Radio playback", NotificationManager.IMPORTANCE_LOW))
        }
        session = MediaSession(this, "MegaRadio").apply {
            setSessionActivity(openPlayer())
            setCallback(object : MediaSession.Callback() {
                override fun onPlay() = sendControl("resume")
                override fun onPause() = sendControl("pause")
                override fun onStop() { sendControl("stop"); stopSelf() }
            })
            isActive = true
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_CONTROL) {
            intent.getStringExtra("command")?.let(::sendControl)
            return START_NOT_STICKY
        }
        val state = try { JSONObject(intent?.getStringExtra("state") ?: "{}") } catch (_: Exception) { JSONObject() }
        val playing = state.optBoolean("playing")
        val title = state.optString("title", "MegaRadio").take(200)
        session.setMetadata(MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, title)
            .putString(MediaMetadata.METADATA_KEY_ARTIST, "MegaRadio")
            .putLong(MediaMetadata.METADATA_KEY_DURATION, -1)
            .putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART,
                BitmapFactory.decodeResource(resources, R.mipmap.ic_launcher)).build())
        session.setPlaybackState(PlaybackState.Builder()
            .setActions(PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PAUSE or
                PlaybackState.ACTION_PLAY_PAUSE or PlaybackState.ACTION_STOP)
            .setState(if (playing) PlaybackState.STATE_PLAYING else PlaybackState.STATE_PAUSED,
                PlaybackState.PLAYBACK_POSITION_UNKNOWN, if (playing) 1f else 0f).build())
        val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CHANNEL) else Notification.Builder(this)
        val notification = builder.setSmallIcon(R.drawable.ic_radio_notification)
            .setContentTitle(title).setContentText("MegaRadio").setContentIntent(openPlayer())
            .setVisibility(Notification.VISIBILITY_PUBLIC).setOngoing(playing)
            .addAction(Notification.Action.Builder(
                if (playing) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play,
                if (playing) getString(R.string.pause) else getString(R.string.play),
                controlIntent(if (playing) "pause" else "resume")).build())
            .setStyle(Notification.MediaStyle().setMediaSession(session.sessionToken).setShowActionsInCompactView(0))
            .build()
        if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFICATION, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
        else startForeground(NOTIFICATION, notification)
        return START_NOT_STICKY
    }

    private fun openPlayer(): PendingIntent = PendingIntent.getActivity(this, 1,
        Intent(this, MainActivity::class.java).setAction(Intent.ACTION_VIEW)
            .setData(Uri.parse("megaradio://player")), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    private fun controlIntent(command: String): PendingIntent = PendingIntent.getService(this, command.hashCode(),
        Intent(this, TvPlaybackService::class.java).setAction(ACTION_CONTROL).putExtra("command", command),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    private fun sendControl(command: String) {
        sendBroadcast(Intent(ACTION_CONTROL).setPackage(packageName).putExtra("command", command))
    }

    override fun onBind(intent: Intent?): IBinder? = null
    override fun onDestroy() { session.release(); super.onDestroy() }

    companion object {
        const val ACTION_CONTROL = "com.megaradio.tv.PLAYBACK_CONTROL"
        private const val CHANNEL = "radio_playback"
        private const val NOTIFICATION = 93
    }
}
