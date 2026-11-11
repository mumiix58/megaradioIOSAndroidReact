plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.megaradio.tv"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.megaradio"
        minSdk = 23          // Android TV baseline (API 23 covers Fire TV Stick 4K)
        targetSdk = 35
        versionCode = 93
        versionName = "1.0.70"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { viewBinding = true }
}

apply(from = rootProject.file("../../scripts/android-release-signing.gradle"))

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.leanback:leanback:1.0.0")
    implementation("androidx.tvprovider:tvprovider:1.1.0")
    implementation("androidx.webkit:webkit:1.11.0")
    implementation("androidx.media:media:1.7.0")
    // Google Play Billing v8 — in-app purchases / subscriptions for the
    // Premium plan (mirror of the mobile app's react-native-iap setup).
    implementation("com.android.billingclient:billing:8.3.0")
    // Coroutines used by BillingService for suspend-style purchase flows.
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    testImplementation("junit:junit:4.13.2")
}
