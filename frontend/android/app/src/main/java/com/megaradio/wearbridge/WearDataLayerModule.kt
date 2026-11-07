package com.megaradio.wearbridge

import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.wearable.DataMap
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import org.json.JSONArray
import org.json.JSONObject

class WearDataLayerModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    private var listeners = 0
    private var initialized = false
    private var station = "{}"
    private var playing = false
    private var title = ""
    private var artist = ""
    override fun getName() = "WearDataLayer"

    @ReactMethod override fun initialize() {
        super.initialize()
        if (initialized) return
        initialized = true
        WearCommandBus.listener = { command ->
            if (listeners < 1 || !context.hasActiveReactInstance()) false else {
                val map = Arguments.createMap()
                command.forEach { (key, value) -> map.putString(key, value) }
                context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit("onWearCommand", map)
                true
            }
        }
        WearCommandBus.flush()
    }
    @ReactMethod fun addListener(eventName: String) { listeners++; WearCommandBus.flush() }
    @ReactMethod fun removeListeners(count: Int) { listeners = (listeners - count).coerceAtLeast(0) }
    override fun invalidate() { WearCommandBus.listener = null; initialized = false; super.invalidate() }
    @ReactMethod fun isWearConnected(promise: Promise) {
        Wearable.getNodeClient(context).connectedNodes.addOnSuccessListener { promise.resolve(it.isNotEmpty()) }
            .addOnFailureListener { promise.reject("WEAR_UNAVAILABLE", it) }
    }
    private fun publish(path: String, build: (DataMap) -> Unit) {
        try {
            val request = PutDataMapRequest.create(path)
            build(request.dataMap)
            request.dataMap.putLong("updatedAt", System.currentTimeMillis())
            Wearable.getDataClient(context).putDataItem(request.asPutDataRequest().setUrgent())
                .addOnFailureListener { Log.w("WearDataLayer", "State sync failed: ${it.javaClass.simpleName}") }
        } catch (error: Exception) { Log.w("WearDataLayer", "Invalid companion data: ${error.javaClass.simpleName}") }
    }
    private fun publishList(path: String, json: String, requestId: String? = null, error: String = "") {
        try {
            val input = JSONArray(json)
            val compact = JSONArray()
            val limit = if (path in setOf("/megaradio/countries", "/megaradio/genres")) 500 else 100
            for (index in 0 until minOf(input.length(), limit)) compact.put(input.get(index))
            var payload = compact.toString()
            while (payload.toByteArray(Charsets.UTF_8).size > 90000 && compact.length() > 0) {
                compact.remove(compact.length() - 1)
                payload = compact.toString()
            }
            publish(path) {
                it.putString("data", payload)
                if (requestId != null) it.putString("requestId", requestId)
                if (error.isNotEmpty()) it.putString("error", error)
            }
        } catch (_: Exception) {}
    }
    @ReactMethod fun updateFavorites(json: String) = publishList("/megaradio/favorites", json)
    @ReactMethod fun updateStations(json: String) = publishList("/megaradio/stations", json)
    @ReactMethod fun updateStationResponse(requestId: String, json: String, error: String) =
        publishList("/megaradio/station_response", json, requestId, error)
    @ReactMethod fun updateGenres(json: String) = publishList("/megaradio/genres", json)
    @ReactMethod fun updateCountries(json: String) = publishList("/megaradio/countries", json)
    @ReactMethod fun updateNowPlaying(json: String, isPlaying: Boolean, songTitle: String, artistName: String) {
        try { JSONObject(json) } catch (_: Exception) { return }
        station = json; playing = isPlaying; title = songTitle; artist = artistName
        publishNowPlaying()
    }
    @ReactMethod fun updatePlaybackState(isPlaying: Boolean, songTitle: String, artistName: String) {
        playing = isPlaying; title = songTitle; artist = artistName
        publishNowPlaying()
    }
    private fun publishNowPlaying() = publish("/megaradio/now_playing") {
        it.putString("station", station); it.putBoolean("isPlaying", playing)
        it.putString("songTitle", title); it.putString("artistName", artist)
    }
}
