package com.megaradio

import android.app.Application
import android.content.res.Configuration

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactNativeHost

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ReactNativeHostWrapper

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost = ReactNativeHostWrapper(
      this,
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              add(com.megaradio.AndroidAutoPackage())
              add(com.megaradio.wearbridge.WearDataLayerPackage())
              // Packages that cannot be autolinked yet can be added manually here, for example:
              // add(MyReactNativePackage())
            }

          override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"

          override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

          override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
      }
  )

  override val reactHost: ReactHost
    get() = ReactNativeHostWrapper.createReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    DefaultNewArchitectureEntryPoint.releaseLevel = try {
      ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
    } catch (e: IllegalArgumentException) {
      ReleaseLevel.STABLE
    }
    recordNativeLaunchContext()
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  // Capture installation facts before React/JS can fail to load. These bounded
  // values distinguish a broken ABI split from a missing library in our bundle.
  @Suppress("DEPRECATION")
  private fun recordNativeLaunchContext() {
    try {
      val sdkClass = Class.forName("com.google.firebase.crashlytics.FirebaseCrashlytics")
      val sdk = sdkClass.getMethod("getInstance").invoke(null)
      val setKey = sdkClass.getMethod("setCustomKey", String::class.java, String::class.java)
      val installer = try { packageManager.getInstallerPackageName(packageName) } catch (_: Exception) { null }
      val source = when (installer) {
        "com.android.vending" -> "google_play"
        "com.google.android.packageinstaller", "com.android.packageinstaller" -> "package_installer"
        null -> "unknown"
        else -> "other"
      }
      val values = mapOf(
        "native_install_source" to source,
        "native_process_bits" to if (android.os.Process.is64Bit()) "64" else "32",
        "native_device_abi" to (android.os.Build.SUPPORTED_ABIS.firstOrNull() ?: "unknown"),
        "native_react_library_on_disk" to java.io.File(applicationInfo.nativeLibraryDir, "libreactnative.so").isFile.toString(),
        "native_split_count" to (applicationInfo.splitSourceDirs?.size ?: 0).coerceAtMost(100).toString(),
        "native_build" to BuildConfig.VERSION_CODE.toString(),
      )
      for ((key, value) in values) setKey.invoke(sdk, key, value)
    } catch (_: Exception) {
      // Crash reporting must never prevent a normal application launch.
    } catch (_: LinkageError) {
      // A missing optional reporting SDK must not mask the original loader error.
    }
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
