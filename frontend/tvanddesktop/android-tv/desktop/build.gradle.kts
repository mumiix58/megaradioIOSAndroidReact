plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.megaradio.tv"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.megaradio"
        minSdk = 23
        targetSdk = 36
        versionCode = 98
        versionName = "1.0.70"
    }
    // TV and Android desktop execute the same native shell and CDN application.
    // Only the manifest differs: desktops don't require a Leanback launcher.
    sourceSets {
        getByName("main") {
            java.srcDir("../app/src/main/java")
            res.srcDir("../app/src/main/res")
        }
        getByName("test").java.srcDir("../app/src/test/java")
    }
    buildTypes {
        release { isMinifyEnabled = false }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

apply(from = rootProject.file("../../scripts/android-release-signing.gradle"))

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.tvprovider:tvprovider:1.1.0")
    implementation("androidx.webkit:webkit:1.11.0")
    implementation("androidx.media:media:1.7.0")
    implementation("com.android.billingclient:billing:8.3.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    testImplementation("junit:junit:4.13.2")
}
