// Expo Config Plugin: Bulletproof fix for AdMob MobileAdsInitProvider crash
//
// ROOT CAUSE (Feb 2026):
// The react-native-google-mobile-ads library's AAR AndroidManifest.xml uses
// Gradle manifest placeholders like ${appJSONGoogleMobileAdsAppID}.
// The library's config plugin adds meta-data to the SOURCE manifest with
// tools:replace, but NEVER defines these placeholders in build.gradle's
// manifestPlaceholders. If tools:replace fails during manifest merge,
// the placeholder resolves to empty/invalid → crash.
//
// FIX: Define manifestPlaceholders in build.gradle so the placeholder
// ALWAYS resolves to the correct value, regardless of tools:replace.

const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const ADMOB_ANDROID_APP_ID = 'ca-app-pub-8771434485570434~7427742767';
const ADMOB_IOS_APP_ID = 'ca-app-pub-8771434485570434~4044224468';

// Layer 1: Ensure meta-data in source manifest (backup)
function withAdMobManifestAPI(config) {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults;
    const application = manifest.manifest.application[0];

    if (!application['meta-data']) application['meta-data'] = [];
    if (!manifest.manifest.$['xmlns:tools']) {
      manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    // Remove ALL existing AdMob APPLICATION_ID entries to prevent duplicates
    application['meta-data'] = application['meta-data'].filter(
      (m) => !(m.$ && m.$['android:name'] === 'com.google.android.gms.ads.APPLICATION_ID')
    );

    // Add correct AdMob meta-data with tools:replace
    application['meta-data'].push({
      $: {
        'android:name': 'com.google.android.gms.ads.APPLICATION_ID',
        'android:value': ADMOB_ANDROID_APP_ID,
        'tools:replace': 'android:value',
      },
    });

    // The ads plugin appends optimization flags on incremental prebuilds.
    // This mod runs after it and keeps exactly one value per AdMob key.
    const seen = new Set();
    application['meta-data'] = application['meta-data'].filter(entry => {
      const name = entry.$?.['android:name'];
      if (!name?.startsWith('com.google.android.gms.ads.')) return true;
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });

    console.log('[withAdMobFix] Layer 1: Source manifest meta-data set');
    return config;
  });
}

// Layer 2: THE REAL FIX — Add manifestPlaceholders to build.gradle
function withAdMobManifestPlaceholders(config) {
  return withDangerousMod(config, ['android', async (config) => {
    const buildGradlePath = path.join(
      config.modRequest.projectRoot,
      'android/app/build.gradle'
    );

    if (!fs.existsSync(buildGradlePath)) return config;

    let content = fs.readFileSync(buildGradlePath, 'utf-8');

    // Skip if already applied
    if (content.includes('appJSONGoogleMobileAdsAppID')) {
      console.log('[withAdMobFix] Layer 2: manifestPlaceholders already present');
      return config;
    }

    // Add manifestPlaceholders to defaultConfig
    // This resolves ALL ${appJSON...} placeholders in the library's AAR manifest
    const placeholders = `
        // MEGARADIO_ADMOB_PLACEHOLDERS: Resolve library manifest placeholders
        manifestPlaceholders += [
            appJSONGoogleMobileAdsAppID: "${ADMOB_ANDROID_APP_ID}",
            appJSONGoogleMobileAdsDelayAppMeasurementInit: "true",
            appJSONGoogleMobileAdsOptimizeInitialization: "true",
            appJSONGoogleMobileAdsOptimizeAdLoading: "true"
        ]`;

    // Insert into defaultConfig block
    if (content.includes('defaultConfig {')) {
      // Find defaultConfig block and add after its opening brace
      content = content.replace(
        /(defaultConfig\s*\{)/,
        `$1\n${placeholders}`
      );
      console.log('[withAdMobFix] Layer 2: manifestPlaceholders added to defaultConfig');
    } else {
      console.warn('[withAdMobFix] Layer 2: WARNING - defaultConfig block not found!');
    }

    fs.writeFileSync(buildGradlePath, content);
    return config;
  }]);
}

// Layer 3: Raw XML backup patching of source manifest
function withAdMobRawXML(config) {
  return withDangerousMod(config, ['android', async (config) => {
    const manifestPath = path.join(
      config.modRequest.projectRoot,
      'android/app/src/main/AndroidManifest.xml'
    );

    if (!fs.existsSync(manifestPath)) return config;

    let content = fs.readFileSync(manifestPath, 'utf-8');
    let modified = false;

    // Ensure xmlns:tools
    if (!content.includes('xmlns:tools=')) {
      content = content.replace('<manifest ', '<manifest xmlns:tools="http://schemas.android.com/tools" ');
      modified = true;
    }

    // Force-add AdMob meta-data if missing
    if (!content.includes(ADMOB_ANDROID_APP_ID)) {
      // Remove any existing APPLICATION_ID meta-data first
      content = content.replace(
        /<meta-data[^>]*com\.google\.android\.gms\.ads\.APPLICATION_ID[^/]*\/>/g,
        ''
      );
      content = content.replace(
        '</application>',
        `    <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="${ADMOB_ANDROID_APP_ID}" tools:replace="android:value" />\n    </application>`
      );
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(manifestPath, content);
    }
    console.log('[withAdMobFix] Layer 3: Raw XML backup done');
    return config;
  }]);
}

// Layer 4: iOS Info.plist — Add GADApplicationIdentifier
// Without this, the Google Mobile Ads SDK crashes on launch with:
// 'GADInvalidInitializationException': The Google Mobile Ads SDK was initialized without an application ID.
function withAdMobIOSInfoPlist(config) {
  return withDangerousMod(config, ['ios', async (config) => {
    const infoPlistPath = path.join(
      config.modRequest.projectRoot,
      'ios/MegaRadio/Info.plist'
    );

    if (!fs.existsSync(infoPlistPath)) return config;

    let content = fs.readFileSync(infoPlistPath, 'utf-8');

    if (content.includes('GADApplicationIdentifier')) {
      console.log('[withAdMobFix] Layer 4: iOS GADApplicationIdentifier already present');
      return config;
    }

    // Insert GADApplicationIdentifier before closing </dict>
    const gadEntry = `\t<key>GADApplicationIdentifier</key>\n\t<string>${ADMOB_IOS_APP_ID}</string>\n\t<key>GADIsAdManagerApp</key>\n\t<false/>\n\t<key>SKAdNetworkItems</key>\n\t<array>\n\t\t<dict>\n\t\t\t<key>SKAdNetworkIdentifier</key>\n\t\t\t<string>cstr6suwn9.skadnetwork</string>\n\t\t</dict>\n\t</array>`;

    // Find the last </dict> in the plist (closing the root dict)
    const lastDictIndex = content.lastIndexOf('</dict>');
    if (lastDictIndex !== -1) {
      content = content.slice(0, lastDictIndex) + gadEntry + '\n' + content.slice(lastDictIndex);
      fs.writeFileSync(infoPlistPath, content);
      console.log('[withAdMobFix] Layer 4: Added GADApplicationIdentifier to iOS Info.plist');
    }

    return config;
  }]);
}


module.exports = function withAdMobFix(config) {
  config = withAdMobManifestAPI(config);       // Layer 1: Expo manifest API
  config = withAdMobManifestPlaceholders(config); // Layer 2: THE FIX - manifestPlaceholders
  config = withAdMobRawXML(config);            // Layer 3: Raw XML backup
  config = withAdMobIOSInfoPlist(config);      // Layer 4: iOS Info.plist GADApplicationIdentifier
  return config;
};
