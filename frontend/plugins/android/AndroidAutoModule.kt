package com.megaradio

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.NativeModule
import com.facebook.react.ReactPackage
import com.facebook.react.uimanager.ViewManager
import org.json.JSONObject

/** An explicit shared cache; AsyncStorage is a database, not SharedPreferences. */
class AndroidAutoModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    override fun getName() = "AndroidAutoModule"

    @ReactMethod
    fun syncCatalog(catalog: ReadableMap) {
        val json = JSONObject(catalog.toHashMap()).toString()
        reactApplicationContext.getSharedPreferences("megaradio_auto", 0)
            .edit().putString("catalog", json).apply()
    }
}

class AndroidAutoPackage : ReactPackage {
    override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(AndroidAutoModule(context))
    override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
