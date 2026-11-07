// Expo Config Plugin for Full Android Auto Media App Support
// ============================================================
// Creates a fully compliant Android Auto MediaBrowserService with:
// - Native MediaPlayer for streaming radio
// - Full MediaSessionCompat with Callback (play/pause/skip/playFromMediaId)
// - Content Style Hints (grid for categories, list for stations)
// - Attribution Icon + Accent Color Theme
// - Audio Focus management
// - Catalog synchronized explicitly from the app and fetched from its public API
// - Aggressive cleanup of react-native-carplay navigation artifacts

const {
  withAndroidManifest,
  withDangerousMod,
  withMainApplication,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// ============================================================
// KOTLIN: MegaRadioAutoService.kt
// ============================================================
const MEDIA_BROWSER_SERVICE_KOTLIN = fs.readFileSync(path.join(__dirname, 'android/MegaRadioAutoService.kt'), 'utf8');

// ============================================================
// RESOURCES
// ============================================================

// Monochrome headphone icon for Android Auto attribution
const IC_AUTO_ICON_XML = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M12,3C7.03,3 3,7.03 3,12v7c0,1.1 0.9,2 2,2h2v-9H5v-2c0,-3.87 3.13,-7 7,-7s7,3.13 7,7v2h-2v9h2c1.1,0 2,-0.9 2,-2v-7C21,7.03 16.97,3 12,3z" />
</vector>
`;

// Category icons (Material Design, monochrome)
const IC_HEART_XML = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M12,21.35l-1.45,-1.32C5.4,15.36 2,12.28 2,8.5 2,5.42 4.42,3 7.5,3c1.74,0 3.41,0.81 4.5,2.09C13.09,3.81 14.76,3 16.5,3 19.58,3 22,5.42 22,8.5c0,3.78 -3.4,6.86 -8.55,11.54L12,21.35z" />
</vector>
`;

const IC_CLOCK_XML = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M11.99,2C6.47,2 2,6.48 2,12s4.47,10 9.99,10C17.52,22 22,17.52 22,12S17.52,2 11.99,2zM12,20c-4.42,0 -8,-3.58 -8,-8s3.58,-8 8,-8 8,3.58 8,8 -3.58,8 -8,8zM12.5,7H11v6l5.25,3.15 0.75,-1.23 -4.5,-2.67z" />
</vector>
`;

const IC_STAR_XML = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M12,17.27L18.18,21l-1.64,-7.03L22,9.24l-7.19,-0.61L12,2 9.19,8.63 2,9.24l5.46,4.73L5.82,21z" />
</vector>
`;

const IC_MUSIC_XML = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M12,3v10.55c-0.59,-0.34 -1.27,-0.55 -2,-0.55C7.79,13 6,14.79 6,17s1.79,4 4,4 4,-1.79 4,-4V7h4V3h-6z" />
</vector>
`;

// Accent color theme for Android Auto
const AUTO_THEME_XML = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="MegaRadioAutoTheme">
        <item name="colorAccent">#FF4199</item>
    </style>
</resources>
`;

// automotive_app_desc.xml (declares this is a MEDIA app, not NAVIGATION)
const AUTOMOTIVE_APP_DESC_XML = `<?xml version="1.0" encoding="utf-8"?>
<automotiveApp>
    <uses name="media" />
</automotiveApp>
`;

// ============================================================
// MANIFEST MODIFICATIONS
// ============================================================
const withAndroidAutoManifest = (config) => {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults;
    const application = manifest.manifest.application[0];

    // Ensure tools namespace
    if (!manifest.manifest.$['xmlns:tools']) {
      manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }
    if (!application['meta-data']) application['meta-data'] = [];
    if (!application.service) application.service = [];
    if (!manifest.manifest['uses-permission']) manifest.manifest['uses-permission'] = [];

    // ────────────────────────────────────────────────────────
    // CLEANUP: Remove react-native-carplay navigation artifacts
    // ────────────────────────────────────────────────────────
    const NAV_PERMS = [
      'androidx.car.app.NAVIGATION_TEMPLATES',
      'androidx.car.app.MAP_TEMPLATES',
      'androidx.car.app.ACCESS_SURFACE',
    ];

    manifest.manifest['uses-permission'] = manifest.manifest['uses-permission'].filter((p) => {
      const name = p.$ && p.$['android:name'];
      if (NAV_PERMS.includes(name)) {
        console.log(`[withAndroidAuto] Removed nav permission: ${name}`);
        return false;
      }
      return true;
    });

    // Block AAR merge of navigation permissions
    NAV_PERMS.forEach((perm) => {
      if (!manifest.manifest['uses-permission'].find(p => p.$?.['android:name'] === perm && p.$?.['tools:node'] === 'remove')) {
        manifest.manifest['uses-permission'].push({
          $: { 'android:name': perm, 'tools:node': 'remove' },
        });
      }
    });

    // Remove carplay services
    application.service = application.service.filter((s) => {
      const name = s.$ && s.$['android:name'];
      if (name && (name.includes('CarPlayService') || name.includes('CarPlayHeadlessTaskService'))) {
        console.log(`[withAndroidAuto] Removed carplay service: ${name}`);
        return false;
      }
      return true;
    });

    // Remove carplay activities
    if (application.activity) {
      application.activity = application.activity.filter((a) => {
        const name = a.$ && a.$['android:name'];
        return !(name && name.includes('carplay'));
      });
    }

    // Remove minCarApiLevel meta-data
    application['meta-data'] = application['meta-data'].filter((m) => {
      return m.$?.['android:name'] !== 'androidx.car.app.minCarApiLevel';
    });

    // Block AAR merge of carplay services
    const blockServices = [
      'org.birkir.carplay.CarPlayService',
      'org.birkir.carplay.CarPlayHeadlessTaskService',
    ];
    blockServices.forEach((svc) => {
      if (!application.service.find(s => s.$?.['android:name'] === svc)) {
        application.service.push({
          $: { 'android:name': svc, 'tools:node': 'remove' },
        });
      }
    });

    // ────────────────────────────────────────────────────────
    // Remove MediaBrowserService intent from TrackPlayer MusicService
    // (our MegaRadioAutoService is the sole MediaBrowserService)
    // ────────────────────────────────────────────────────────
    application.service = application.service.map((s) => {
      if (s.$?.['android:name'] === 'com.doublesymmetry.trackplayer.service.MusicService') {
        if (s['intent-filter']) {
          s['intent-filter'] = s['intent-filter'].filter((f) => {
            const actions = f.action || [];
            return !actions.some((a) => a.$?.['android:name'] === 'android.media.browse.MediaBrowserService');
          });
          if (s['intent-filter'].length === 0) delete s['intent-filter'];
        }
        console.log('[withAndroidAuto] Stripped MediaBrowserService intent from MusicService');
      }
      return s;
    });

    // ────────────────────────────────────────────────────────
    // ADD: Android Auto Media App configuration
    // ────────────────────────────────────────────────────────

    // 1. com.google.android.gms.car.application → automotive_app_desc.xml
    if (!application['meta-data'].find(m => m.$?.['android:name'] === 'com.google.android.gms.car.application')) {
      application['meta-data'].push({
        $: {
          'android:name': 'com.google.android.gms.car.application',
          'android:resource': '@xml/automotive_app_desc',
        },
      });
      console.log('[withAndroidAuto] Added car.application meta-data');
    }

    // 2. Attribution Icon (monochrome, tintable)
    if (!application['meta-data'].find(m => m.$?.['android:name'] === 'androidx.car.app.TintableAttributionIcon')) {
      application['meta-data'].push({
        $: {
          'android:name': 'androidx.car.app.TintableAttributionIcon',
          'android:resource': '@drawable/ic_auto_icon',
        },
      });
      console.log('[withAndroidAuto] Added TintableAttributionIcon');
    }

    // 3. Accent Color Theme
    if (!application['meta-data'].find(m => m.$?.['android:name'] === 'com.google.android.gms.car.application.theme')) {
      application['meta-data'].push({
        $: {
          'android:name': 'com.google.android.gms.car.application.theme',
          'android:resource': '@style/MegaRadioAutoTheme',
        },
      });
      console.log('[withAndroidAuto] Added car.application.theme');
    }

    // 4. MegaRadioAutoService (sole MediaBrowserService)
    // Remove any existing entry first
    application.service = application.service.filter(
      (s) => s.$?.['android:name'] !== '.MegaRadioAutoService'
    );
    application.service.push({
      $: {
        'android:name': '.MegaRadioAutoService',
        'android:exported': 'true',
        'android:foregroundServiceType': 'mediaPlayback',
      },
      'intent-filter': [
        {
          action: [
            { $: { 'android:name': 'android.media.browse.MediaBrowserService' } },
          ],
        },
      ],
    });
    console.log('[withAndroidAuto] Added MegaRadioAutoService as sole MediaBrowserService');

    return config;
  });
};

// ============================================================
// NATIVE FILE CREATION
// ============================================================
const withAndroidAutoNativeFiles = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const root = config.modRequest.projectRoot;
      const androidMain = path.join(root, 'android', 'app', 'src', 'main');

      // 1. res/xml/automotive_app_desc.xml
      const xmlDir = path.join(androidMain, 'res', 'xml');
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(path.join(xmlDir, 'automotive_app_desc.xml'), AUTOMOTIVE_APP_DESC_XML);
      console.log('[withAndroidAuto] Created automotive_app_desc.xml');

      // 2. res/drawable/ icons (Attribution + Category)
      const drawableDir = path.join(androidMain, 'res', 'drawable');
      fs.mkdirSync(drawableDir, { recursive: true });
      fs.writeFileSync(path.join(drawableDir, 'ic_auto_icon.xml'), IC_AUTO_ICON_XML);
      fs.writeFileSync(path.join(drawableDir, 'ic_heart.xml'), IC_HEART_XML);
      fs.writeFileSync(path.join(drawableDir, 'ic_clock.xml'), IC_CLOCK_XML);
      fs.writeFileSync(path.join(drawableDir, 'ic_star.xml'), IC_STAR_XML);
      fs.writeFileSync(path.join(drawableDir, 'ic_music.xml'), IC_MUSIC_XML);
      console.log('[withAndroidAuto] Created drawable icons (auto, heart, clock, star, music)');

      // 3. res/values/auto_theme.xml (Accent Color)
      const valuesDir = path.join(androidMain, 'res', 'values');
      fs.mkdirSync(valuesDir, { recursive: true });
      fs.writeFileSync(path.join(valuesDir, 'auto_theme.xml'), AUTO_THEME_XML);
      console.log('[withAndroidAuto] Created auto_theme.xml');

      // 4. MegaRadioAutoService.kt
      const kotlinDir = path.join(androidMain, 'java', 'com', 'megaradio');
      fs.mkdirSync(kotlinDir, { recursive: true });
      fs.writeFileSync(path.join(kotlinDir, 'MegaRadioAutoService.kt'), MEDIA_BROWSER_SERVICE_KOTLIN);
      fs.copyFileSync(path.join(__dirname, 'android/AndroidAutoModule.kt'), path.join(kotlinDir, 'AndroidAutoModule.kt'));
      console.log('[withAndroidAuto] Created MegaRadioAutoService.kt');

      return config;
    },
  ]);
};

// ============================================================
// MAIN EXPORT
// ============================================================
module.exports = function withAndroidAutoFull(config) {
  console.log('[withAndroidAuto] Applying full Android Auto Media App configuration...');
  config = withMainApplication(config, c => {
    const statement = 'add(com.megaradio.AndroidAutoPackage())';
    if (!c.modResults.contents.includes(statement)) {
      const anchor = 'PackageList(this).packages.apply {';
      if (!c.modResults.contents.includes(anchor)) throw new Error('Android Auto: unsupported MainApplication template');
      c.modResults.contents = c.modResults.contents.replace(anchor, `${anchor}\n              ${statement}`);
    }
    return c;
  });
  config = withAndroidAutoManifest(config);
  config = withAndroidAutoNativeFiles(config);
  return config;
};
