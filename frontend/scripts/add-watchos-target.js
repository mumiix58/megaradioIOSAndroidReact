#!/usr/bin/env node
/**
 * add-watchos-target.js
 *
 * Idempotently adds the MegaRadioWatch watchOS app target to
 * ios/MegaRadio.xcodeproj so you don't have to manually re-add it after
 * every `pod install` / `git pull`.
 *
 * Source watch files live at `frontend/watch/ios/MegaRadioWatch/` and are
 * copied (overwriting only if newer) into `frontend/ios/MegaRadioWatch/`
 * which is where Xcode expects them to be.
 *
 * What it does:
 *   1. Copies watch source files into ios/MegaRadioWatch/
 *   2. Adds the MegaRadioWatch target (WKApplication) with proper build
 *      settings (deployment target watchOS 8.0, signing inherited from
 *      main app team, bundle id com.visiongo.megaradio.watchkitapp).
 *   3. Registers every .swift / .plist / asset under that target.
 *   4. Creates the Embed Watch Content build phase on the iOS app target
 *      so the watch app is bundled inside the iPhone IPA.
 *   5. Adds the necessary target dependency.
 *
 * IDEMPOTENT — safe to re-run any number of times. Detects an existing
 * MegaRadioWatch target and exits early if found.
 *
 * Usage (from frontend/):
 *   node scripts/add-watchos-target.js
 *
 * Run AFTER `pod install` (because pod install may regenerate the pbxproj).
 */

const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────
// Resolve the `xcode` parser. Some users hit Node v23+ resolver quirks
// where `require('xcode')` fails even though node_modules/xcode exists
// (top-level deps changed between Expo SDK versions). We try multiple
// resolution paths, and if all fail we auto-install it locally.
// ─────────────────────────────────────────────────────────────────────
let xcode;
function tryLoadXcode() {
  const candidates = [
    'xcode',
    path.join(__dirname, '..', 'node_modules', 'xcode'),
    path.join(__dirname, '..', 'node_modules', '@expo', 'config-plugins', 'node_modules', 'xcode'),
  ];
  for (const c of candidates) {
    try {
      // eslint-disable-next-line global-require
      return require(c);
    } catch (_) { /* try next */ }
  }
  return null;
}
xcode = tryLoadXcode();
if (!xcode) {
  console.log('[add-watchos-target] `xcode` npm package not found — installing it now…');
  const { execSync } = require('child_process');
  try {
    execSync('yarn add --dev --ignore-scripts xcode@^3.0.1', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
    });
  } catch (e) {
    console.error('\u001b[31m[add-watchos-target] Failed to auto-install `xcode`. Run manually:\u001b[0m');
    console.error('  cd frontend && yarn add --dev xcode');
    process.exit(1);
  }
  xcode = tryLoadXcode();
  if (!xcode) {
    console.error('\u001b[31m[add-watchos-target] Still cannot load `xcode` after install. Aborting.\u001b[0m');
    process.exit(1);
  }
}

const REPO_ROOT = path.resolve(__dirname, '..');
const IOS_DIR = path.join(REPO_ROOT, 'ios');
const PBX_PATH = path.join(IOS_DIR, 'MegaRadio.xcodeproj', 'project.pbxproj');
const WATCH_SRC = path.join(REPO_ROOT, 'watch', 'ios', 'MegaRadioWatch');
const WATCH_DEST = path.join(IOS_DIR, 'MegaRadioWatch');
const TARGET_NAME = 'MegaRadioWatch';
const WATCH_BUNDLE_ID = 'com.visiongo.megaradio.watchkitapp';
const MAIN_BUNDLE_ID = 'com.visiongo.megaradio';
const WATCHOS_DEPLOYMENT_TARGET = '9.0';

function log(msg) { console.log('[add-watchos-target] ' + msg); }
function fail(msg) { console.error('\u001b[31m[add-watchos-target] ERROR: ' + msg + '\u001b[0m'); process.exit(1); }

if (!fs.existsSync(PBX_PATH)) fail('pbxproj not found at: ' + PBX_PATH);
if (!fs.existsSync(WATCH_SRC)) fail('Watch source dir not found at: ' + WATCH_SRC);

// ─────────────────────────────────────────────────────────────────────
// 1. Copy watch sources into ios/MegaRadioWatch/
// ─────────────────────────────────────────────────────────────────────
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}
log('Copying watch sources → ' + path.relative(REPO_ROOT, WATCH_DEST));
copyDir(WATCH_SRC, WATCH_DEST);

// Walk the destination tree and return relative paths for every regular file.
function walkFiles(dir, base = dir) {
  let out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out = out.concat(walkFiles(full, base));
    else out.push(path.relative(base, full));
  }
  return out;
}

const watchFiles = walkFiles(WATCH_DEST).filter((f) => !f.endsWith('.DS_Store'));
const swiftFiles = watchFiles.filter((f) => f.endsWith('.swift'));
const plistFiles = watchFiles.filter((f) => f.endsWith('.plist'));
const entitlementFiles = watchFiles.filter((f) => f.endsWith('.entitlements'));
const assetCatalogs = ['Assets.xcassets']; // single catalog, mounted as a folder ref

log('Found ' + swiftFiles.length + ' swift, ' + plistFiles.length + ' plist, ' + entitlementFiles.length + ' entitlements');

// ─────────────────────────────────────────────────────────────────────
// 2. Open pbxproj
// ─────────────────────────────────────────────────────────────────────

// Defensive fix: xcode-npm's PEG parser crashes with
//   "Expected [\\n\\r] but end of input found"
// when the pbxproj file lacks a trailing newline. Xcode itself sometimes
// writes the file without one (depends on the macOS version + last save
// path). Ensure exactly one trailing newline before parsing.
{
  let raw = fs.readFileSync(PBX_PATH, 'utf8');
  if (!raw.endsWith('\n')) {
    raw = raw.replace(/\s*$/, '') + '\n';
    fs.writeFileSync(PBX_PATH, raw.trimEnd() + '\n');
    log('Normalised pbxproj trailing newline');
  }
}

const proj = xcode.project(PBX_PATH);
proj.parseSync();

// Idempotency check — pbxTargetByName() is unreliable on freshly parsed
// projects, so we scan the native target objects directly.
function findTargetByName(name) {
  const native = proj.hash.project.objects['PBXNativeTarget'] || {};
  for (const k of Object.keys(native)) {
    if (k.endsWith('_comment')) continue;
    const t = native[k];
    if (t && (t.name === name || t.name === '"' + name + '"')) {
      return { uuid: k, target: t };
    }
  }
  return null;
}
// Scrub leaked watch sources from the iOS app target's Sources phase.
// Runs unconditionally — even on repeated invocations — so Xcode "Add Files"
// mistakes from earlier sessions (where the user accidentally ticked the
// MegaRadio target while adding watch .swift files) get cleaned up.
function scrubWatchSourcesFromIosTarget() {
  const nativeTargets = proj.hash.project.objects['PBXNativeTarget'] || {};
  let iosUuid = null;
  for (const k of Object.keys(nativeTargets)) {
    if (k.endsWith('_comment')) continue;
    const t = nativeTargets[k];
    const n = (t && t.name || '').replace(/^"|"$/g, '');
    if (n === 'MegaRadio') { iosUuid = k; break; }
  }
  if (!iosUuid) return 0;

  const iosTgt = nativeTargets[iosUuid];
  const sourcesPhases = proj.hash.project.objects['PBXSourcesBuildPhase'] || {};
  const buildFileSec = proj.pbxBuildFileSection();
  const fileRefSec = proj.pbxFileReferenceSection();
  let totalRemoved = 0;
  (iosTgt.buildPhases || []).forEach((bp) => {
    const phase = sourcesPhases[bp.value];
    if (!phase || !phase.files) return;
    const before = phase.files.length;
    phase.files = phase.files.filter((bf) => {
      const bfObj = buildFileSec[bf.value];
      if (!bfObj || !bfObj.fileRef) return true;
      const ref = fileRefSec[bfObj.fileRef];
      if (!ref) return true;
      const refPath = (ref.path || ref.name || '').replace(/^"|"$/g, '');
      // Strip anything under MegaRadioWatch/ — those belong to the watch target only.
      return !refPath.startsWith('MegaRadioWatch/');
    });
    totalRemoved += (before - phase.files.length);
  });
  return totalRemoved;
}

const scrubbed = scrubWatchSourcesFromIosTarget();
if (scrubbed > 0) {
  log('Removed ' + scrubbed + ' watch source file(s) leaked into iOS target Sources phase ✂️');
  fs.writeFileSync(PBX_PATH, proj.writeSync().trimEnd() + '\n');
}

const existing = findTargetByName(TARGET_NAME);
if (existing) {
  // ─────────────────────────────────────────────────────────────────────
  // REPAIR MODE — pbxproj already has the watch target, but earlier
  // versions of this script wrote a broken dstSubfolderSpec=1 for the
  // Embed Watch Content phase, causing the
  //   MegaRadio.app/MegaRadio.app/Watch/MegaRadioWatch.app
  // doubled-path build cycle. Detect & fix it without removing the
  // target (so the user doesn't lose any signing/team edits).
  // ─────────────────────────────────────────────────────────────────────
  log('Target "' + TARGET_NAME + '" already exists — entering repair mode…');
  const copyPhases = proj.hash.project.objects['PBXCopyFilesBuildPhase'] || {};
  let fixedSpec = 0;
  Object.keys(copyPhases).forEach((k) => {
    if (k.endsWith('_comment')) return;
    const ph = copyPhases[k];
    if (!ph) return;
    const name = (ph.name || '').replace(/^"|"$/g, '');
    if (name === 'Embed Watch Content') {
      // dstSubfolderSpec values:  1=Wrapper, 10=Frameworks, 16=Products
      // For watch app embed the canonical value is 16. Anything else
      // (esp. 1) produces a doubled path and a cycle.
      if (String(ph.dstSubfolderSpec) !== '16') {
        log('  · fixing dstSubfolderSpec ' + ph.dstSubfolderSpec + ' → 16 (Products Directory)');
        ph.dstSubfolderSpec = 16;
        fixedSpec++;
      }
      // Make sure dstPath is the canonical value too.
      if (ph.dstPath !== '"$(CONTENTS_FOLDER_PATH)/Watch"') {
        log('  · fixing dstPath → $(CONTENTS_FOLDER_PATH)/Watch');
        ph.dstPath = '"$(CONTENTS_FOLDER_PATH)/Watch"';
        fixedSpec++;
      }
    }
  });

  if (fixedSpec > 0) {
    fs.writeFileSync(PBX_PATH, proj.writeSync().trimEnd() + '\n');
    log('Repaired ' + fixedSpec + ' Embed Watch Content setting(s). ✅');
  } else {
    log('Embed Watch Content phase already healthy.');
  }

  // ─────────────────────────────────────────────────────────────────────
  // REPAIR — verify the watch target's Sources build phase contains every
  // .swift file. xcode-npm's addTarget() in older script runs sometimes
  // failed to create a Sources phase, producing an empty .app bundle
  // (Info.plist only, no Mach-O executable). Symptom:
  //   "MegaRadioWatch.app is missing its bundle executable"
  // ─────────────────────────────────────────────────────────────────────
  log('Verifying watch target Sources build phase…');
  const watchUuid = existing.uuid;
  const watchTgt = proj.hash.project.objects['PBXNativeTarget'][watchUuid];
  const sourcesAll = proj.hash.project.objects['PBXSourcesBuildPhase'] || {};
  let sourcesUuid = (watchTgt.buildPhases || [])
    .map((bp) => bp.value)
    .find((u) => sourcesAll[u]);

  if (!sourcesUuid) {
    sourcesUuid = proj.generateUuid();
    sourcesAll[sourcesUuid] = {
      isa: 'PBXSourcesBuildPhase',
      buildActionMask: 2147483647,
      files: [],
      runOnlyForDeploymentPostprocessing: 0,
    };
    sourcesAll[sourcesUuid + '_comment'] = 'Sources';
    proj.hash.project.objects['PBXSourcesBuildPhase'] = sourcesAll;
    watchTgt.buildPhases = watchTgt.buildPhases || [];
    // Sources phase should come BEFORE Resources & Embed phases.
    watchTgt.buildPhases.unshift({ value: sourcesUuid, comment: 'Sources' });
    log('  · created missing Sources build phase');
  }
  const sourcesPhase = sourcesAll[sourcesUuid];
  sourcesPhase.files = sourcesPhase.files || [];

  // Build a set of swift filenames currently in the Sources phase so we
  // don't add duplicates on every script run.
  const refSec = proj.pbxFileReferenceSection();
  const bfSec = proj.pbxBuildFileSection();
  const present = new Set();
  sourcesPhase.files.forEach((bf) => {
    const buildFile = bfSec[bf.value];
    if (!buildFile) return;
    const ref = refSec[buildFile.fileRef];
    if (!ref) return;
    const p = (ref.path || ref.name || '').replace(/^"|"$/g, '');
    if (p.startsWith('MegaRadioWatch/') && p.endsWith('.swift')) present.add(p);
  });

  // Look at the MegaRadioWatch group for existing swift file refs.
  // (Files might be referenced in pbxproj but not wired into Sources.)
  const groups = proj.hash.project.objects['PBXGroup'] || {};
  let watchGroupUuid = null;
  Object.keys(groups).forEach((k) => {
    if (k.endsWith('_comment')) return;
    const g = groups[k];
    const gname = (g && (g.name || g.path) || '').replace(/^"|"$/g, '');
    if (gname === 'MegaRadioWatch' || gname === TARGET_NAME) {
      watchGroupUuid = k;
    }
  });

  let addedSources = 0;
  swiftFiles.forEach((rel) => {
    const relPath = 'MegaRadioWatch/' + rel.replace(/\\/g, '/');
    if (present.has(relPath)) return;

    // Find an existing PBXFileReference for this path, or create one.
    let fileRefUuid = null;
    Object.keys(refSec).forEach((k) => {
      if (k.endsWith('_comment')) return;
      const ref = refSec[k];
      const p = ((ref && (ref.path || ref.name)) || '').replace(/^"|"$/g, '');
      if (p === relPath) fileRefUuid = k;
    });
    if (!fileRefUuid) {
      fileRefUuid = proj.generateUuid();
      refSec[fileRefUuid] = {
        isa: 'PBXFileReference',
        lastKnownFileType: 'sourcecode.swift',
        name: path.basename(rel),
        path: relPath,
        sourceTree: '"<group>"',
      };
      refSec[fileRefUuid + '_comment'] = path.basename(rel);
      if (watchGroupUuid) {
        groups[watchGroupUuid].children = groups[watchGroupUuid].children || [];
        groups[watchGroupUuid].children.push({
          value: fileRefUuid,
          comment: path.basename(rel),
        });
      }
    }

    // Add to PBXBuildFile + Sources phase
    const bfUuid = proj.generateUuid();
    bfSec[bfUuid] = {
      isa: 'PBXBuildFile',
      fileRef: fileRefUuid,
      fileRef_comment: path.basename(rel),
    };
    bfSec[bfUuid + '_comment'] = path.basename(rel) + ' in Sources';
    sourcesPhase.files.push({
      value: bfUuid,
      comment: path.basename(rel) + ' in Sources',
    });
    addedSources++;
  });

  if (addedSources > 0) {
    log('  · added ' + addedSources + ' missing Swift source file(s) to Sources phase');
    fs.writeFileSync(PBX_PATH, proj.writeSync().trimEnd() + '\n');
  } else {
    log('  · all ' + swiftFiles.length + ' Swift files already in Sources phase');
  }

  // Defensive: re-scrub leaked sources from iOS target.
  const leaked = scrubWatchSourcesFromIosTarget();
  if (leaked > 0) {
    fs.writeFileSync(PBX_PATH, proj.writeSync().trimEnd() + '\n');
    log('  · scrubbed ' + leaked + ' leaked source(s) from iOS target');
  }

  log('(Watch source files were re-synced from watch/ios/MegaRadioWatch/ above.)');

  // Sync DEVELOPMENT_TEAM from iOS target to watch target build configs
  // (Release/Archive builds skip the watch target without it).
  const repairTeamId = readIosDevelopmentTeam();
  const releaseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app.json'), 'utf8')).expo;
  if (repairTeamId) {
    const watchCfgListUuid = watchTgt.buildConfigurationList;
    const cfgListSec = proj.hash.project.objects['XCConfigurationList'] || {};
    const bcSec = proj.pbxXCBuildConfigurationSection();
    const watchCfgList = cfgListSec[watchCfgListUuid];
    if (watchCfgList && Array.isArray(watchCfgList.buildConfigurations)) {
      let teamFixed = 0;
      watchCfgList.buildConfigurations.forEach((ref) => {
        const bc = bcSec[ref.value];
        if (!bc || !bc.buildSettings) return;
        if (String(bc.buildSettings.MARKETING_VERSION) !== releaseConfig.version || String(bc.buildSettings.CURRENT_PROJECT_VERSION) !== releaseConfig.ios.buildNumber) {
          bc.buildSettings.MARKETING_VERSION = releaseConfig.version;
          bc.buildSettings.CURRENT_PROJECT_VERSION = releaseConfig.ios.buildNumber;
          teamFixed++;
        }
        if (bc.buildSettings.DEVELOPMENT_TEAM !== repairTeamId) {
          bc.buildSettings.DEVELOPMENT_TEAM = repairTeamId;
          teamFixed++;
        }
        // The companion is embedded in the iOS app, not installed as a second
        // top-level archive product (which makes the archive non-exportable).
        if (bc.buildSettings.SKIP_INSTALL !== 'YES') {
          bc.buildSettings.SKIP_INSTALL = 'YES';
          teamFixed++;
        }
        if (bc.buildSettings.ENABLE_USER_SCRIPT_SANDBOXING === 'YES') bc.buildSettings.ENABLE_USER_SCRIPT_SANDBOXING = 'NO';
      });
      if (teamFixed > 0) {
        log('  · propagated DEVELOPMENT_TEAM=' + repairTeamId + ' to ' + teamFixed + ' watch build config(s)');
        fs.writeFileSync(PBX_PATH, proj.writeSync().trimEnd() + '\n');
      }
    }
  } else {
    log('  ⚠️  iOS target has no DEVELOPMENT_TEAM — open Xcode → MegaRadio target → Signing & Capabilities and set your team');
  }

  // Patch the scheme so iOS Release/Archive builds the watch target.
  log('Patching Xcode scheme so Release/Archive builds the watch target…');
  patchScheme();

  // Always re-run cycle fix on repeat invocations — pod install can
  // regenerate broken inputPaths/outputPaths for [CP-User] phases.
  try {
    log('');
    log('Running fix-xcode-cycle.js to scrub [CP-User] cycles…');
    require('./fix-xcode-cycle.js');
  } catch (e) {
    log('  warning: fix-xcode-cycle.js failed: ' + (e && e.message ? e.message : String(e)));
  }
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────
// 3. Add the MegaRadioWatch target as a watchOS application
//    (PRODUCT_TYPE = com.apple.product-type.application,
//     SDKROOT = watchos)
// ─────────────────────────────────────────────────────────────────────
log('Adding target ' + TARGET_NAME + '…');

// Read DEVELOPMENT_TEAM from the iOS app target so we can propagate it to
// the watch target (Release/Archive builds fail to sign without it).
function readIosDevelopmentTeam() {
  const nt = proj.hash.project.objects['PBXNativeTarget'] || {};
  const cfgListSection = proj.hash.project.objects['XCConfigurationList'] || {};
  const bcSection = proj.pbxXCBuildConfigurationSection();
  let iosCfgListUuid = null;
  for (const k of Object.keys(nt)) {
    if (k.endsWith('_comment')) continue;
    const t = nt[k];
    const n = (t && t.name || '').replace(/^"|"$/g, '');
    if (n === 'MegaRadio') {
      iosCfgListUuid = t.buildConfigurationList;
      break;
    }
  }
  if (!iosCfgListUuid) return null;
  const cfgList = cfgListSection[iosCfgListUuid];
  if (!cfgList || !cfgList.buildConfigurations) return null;
  for (const ref of cfgList.buildConfigurations) {
    const bc = bcSection[ref.value];
    if (!bc || !bc.buildSettings) continue;
    if (bc.buildSettings.DEVELOPMENT_TEAM) {
      return String(bc.buildSettings.DEVELOPMENT_TEAM).replace(/^"|"$/g, '');
    }
  }
  return null;
}
const iosTeamId = readIosDevelopmentTeam();
if (iosTeamId) log('Inherited DEVELOPMENT_TEAM from iOS target: ' + iosTeamId);
else log('⚠️  No DEVELOPMENT_TEAM on iOS target — open Xcode → Signing & Capabilities and set your Team manually');

// Create a PBXGroup so files appear under a folder in the navigator.
const groupKey = proj.pbxCreateGroup(TARGET_NAME, 'MegaRadioWatch');

const target = proj.addTarget(TARGET_NAME, 'application', TARGET_NAME, WATCH_BUNDLE_ID);

// addTarget creates an empty target with default Debug/Release configs
// pointing at iphoneos. We have to retro-fit watchOS settings.
const configList = proj.pbxXCConfigurationList()[target.uuid + '_comment'] || null;
const configListSection = proj.pbxXCConfigurationList();
let buildConfigUuids = [];
Object.keys(configListSection).forEach((k) => {
  if (k.endsWith('_comment')) return;
  const item = configListSection[k];
  if (item && Array.isArray(item.buildConfigurations) && configListSection[k + '_comment'] === 'Build configuration list for PBXNativeTarget "' + TARGET_NAME + '"') {
    buildConfigUuids = item.buildConfigurations.map((b) => b.value);
  }
});

const buildConfigSection = proj.pbxXCBuildConfigurationSection();
buildConfigUuids.forEach((uuid) => {
  const bc = buildConfigSection[uuid];
  if (!bc || !bc.buildSettings) return;
  const s = bc.buildSettings;
  s.SDKROOT = 'watchos';
  s.WATCHOS_DEPLOYMENT_TARGET = WATCHOS_DEPLOYMENT_TARGET;
  s.TARGETED_DEVICE_FAMILY = '"4"'; // 4 = Apple Watch
  s.SUPPORTED_PLATFORMS = '"watchsimulator watchos"';
  s.PRODUCT_BUNDLE_IDENTIFIER = WATCH_BUNDLE_ID;
  s.PRODUCT_NAME = '"$(TARGET_NAME)"';
  s.INFOPLIST_FILE = '"MegaRadioWatch/Info.plist"';
  s.CODE_SIGN_ENTITLEMENTS = '"MegaRadioWatch/MegaRadioWatch.entitlements"';
  s.CODE_SIGN_STYLE = 'Automatic';
  const releaseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app.json'), 'utf8')).expo;
  s.MARKETING_VERSION = releaseConfig.version;
  s.CURRENT_PROJECT_VERSION = releaseConfig.ios.buildNumber;
  s.SWIFT_VERSION = '5.0';
  s.SWIFT_STRICT_CONCURRENCY = 'minimal';
  s.ASSETCATALOG_COMPILER_APPICON_NAME = 'AppIcon';
  s.ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = 'AccentColor';
  s.GENERATE_INFOPLIST_FILE = 'NO';
  s.ENABLE_PREVIEWS = 'YES';
  s.SKIP_INSTALL = 'YES';
  s.ENABLE_USER_SCRIPT_SANDBOXING = 'NO';
  s.IPHONEOS_DEPLOYMENT_TARGET = ''; // clear iOS-only setting
  delete s.IPHONEOS_DEPLOYMENT_TARGET;
  // Signing inheritance — copy DEVELOPMENT_TEAM from the iOS target so
  // Release/Archive code-signs against the same Apple Developer team.
  // (Debug builds use lenient development signing and "work" even without
  // an explicit team; Release/Archive does not.)
  if (typeof iosTeamId === 'string' && iosTeamId.length > 0) {
    s.DEVELOPMENT_TEAM = iosTeamId;
  }
});

// ─────────────────────────────────────────────────────────────────────
// 4. Register watch source files under the new target
// ─────────────────────────────────────────────────────────────────────
log('Registering ' + swiftFiles.length + ' Swift source files…');
swiftFiles.forEach((rel) => {
  proj.addSourceFile('MegaRadioWatch/' + rel.replace(/\\/g, '/'), { target: target.uuid }, groupKey);
});

// Re-scrub after adding — xcode-npm's addSourceFile sometimes leaks the
// new build-file refs into BOTH targets. The unconditional scrub above
// already ran earlier but we run it once more after the fact to be safe.
scrubWatchSourcesFromIosTarget();

// Info.plist + entitlements should NOT be in Sources/Resources — Xcode picks
// them up via build settings (INFOPLIST_FILE, CODE_SIGN_ENTITLEMENTS).
// We still add them as file references so they appear in the navigator.
plistFiles.forEach((rel) => {
  proj.addFile('MegaRadioWatch/' + rel.replace(/\\/g, '/'), groupKey);
});
entitlementFiles.forEach((rel) => {
  proj.addFile('MegaRadioWatch/' + rel.replace(/\\/g, '/'), groupKey);
});

// Asset catalog → manual low-level registration.
// xcode-npm's addResourceFile has a bug where it calls pbxGroupByName(uuid)
// expecting a name, returns null, then crashes. We replicate the work it
// would have done by hand: create PBXFileReference (folder.assetcatalog),
// PBXBuildFile, and append to the watch target's PBXResourcesBuildPhase.
log('Registering Assets.xcassets…');

const xcassetsRelPath = 'MegaRadioWatch/Assets.xcassets';
const xcassetsFileRefUuid = proj.generateUuid();
const xcassetsBuildFileUuid = proj.generateUuid();

// PBXFileReference
const fileRefSection = proj.pbxFileReferenceSection();
fileRefSection[xcassetsFileRefUuid] = {
  isa: 'PBXFileReference',
  lastKnownFileType: 'folder.assetcatalog',
  name: 'Assets.xcassets',
  path: xcassetsRelPath,
  sourceTree: '"<group>"',
};
fileRefSection[xcassetsFileRefUuid + '_comment'] = 'Assets.xcassets';

// PBXBuildFile
const buildFileSection = proj.pbxBuildFileSection();
buildFileSection[xcassetsBuildFileUuid] = {
  isa: 'PBXBuildFile',
  fileRef: xcassetsFileRefUuid,
  fileRef_comment: 'Assets.xcassets',
};
buildFileSection[xcassetsBuildFileUuid + '_comment'] = 'Assets.xcassets in Resources';

// Append the file ref to the MegaRadioWatch group
const groupSection = proj.hash.project.objects['PBXGroup'];
if (groupSection && groupSection[groupKey]) {
  groupSection[groupKey].children = groupSection[groupKey].children || [];
  groupSection[groupKey].children.push({
    value: xcassetsFileRefUuid,
    comment: 'Assets.xcassets',
  });
}

// Find the watch target's PBXResourcesBuildPhase and append our build file.
// xcode-npm's addTarget() doesn't always create a Resources phase. If
// missing, synthesize one and wire it into the target's buildPhases list.
const watchTargetObj = proj.hash.project.objects['PBXNativeTarget'][target.uuid];
let resourcesPhaseUuid = (watchTargetObj.buildPhases || [])
  .map((bp) => bp.value)
  .find((uuid) => {
    const phase = proj.hash.project.objects['PBXResourcesBuildPhase'];
    return phase && phase[uuid];
  });
if (!resourcesPhaseUuid) {
  resourcesPhaseUuid = proj.generateUuid();
  if (!proj.hash.project.objects['PBXResourcesBuildPhase']) {
    proj.hash.project.objects['PBXResourcesBuildPhase'] = {};
  }
  proj.hash.project.objects['PBXResourcesBuildPhase'][resourcesPhaseUuid] = {
    isa: 'PBXResourcesBuildPhase',
    buildActionMask: 2147483647,
    files: [],
    runOnlyForDeploymentPostprocessing: 0,
  };
  proj.hash.project.objects['PBXResourcesBuildPhase'][resourcesPhaseUuid + '_comment'] = 'Resources';
  watchTargetObj.buildPhases = watchTargetObj.buildPhases || [];
  watchTargetObj.buildPhases.push({ value: resourcesPhaseUuid, comment: 'Resources' });
}
const phase = proj.hash.project.objects['PBXResourcesBuildPhase'][resourcesPhaseUuid];
phase.files = phase.files || [];
phase.files.push({
  value: xcassetsBuildFileUuid,
  comment: 'Assets.xcassets in Resources',
});

// ─────────────────────────────────────────────────────────────────────
// 5. Embed Watch Content build phase on the iOS app target
//
// xcode-npm's addBuildPhase mangles the dstPath / dstSubfolderSpec values
// for "watch_app", producing builds with $(CONTENTS_FOLDER_PATH) duplicated
// (e.g. MegaRadio.app/MegaRadio.app/Watch/MegaRadioWatch.app — a build
// cycle). We hand-roll the PBXCopyFilesBuildPhase to guarantee the canonical
// "$(CONTENTS_FOLDER_PATH)/Watch" copy-into-wrapper pattern Xcode generates
// from its own UI.
// ─────────────────────────────────────────────────────────────────────
log('Adding Embed Watch Content phase to MegaRadio (iOS) target…');
// pbxTargetByName returns { uuid, target } on success but signature changes
// between xcode-npm versions. Look up the iOS native target directly.
let iosTargetUuidFinal = null;
{
  const nt = proj.hash.project.objects['PBXNativeTarget'] || {};
  for (const k of Object.keys(nt)) {
    if (k.endsWith('_comment')) continue;
    const t = nt[k];
    const n = (t && t.name || '').replace(/^"|"$/g, '');
    if (n === 'MegaRadio') { iosTargetUuidFinal = k; break; }
  }
}
if (!iosTargetUuidFinal) fail('Main "MegaRadio" target not found — pbxproj corrupt?');
const iosTargetObj = proj.hash.project.objects['PBXNativeTarget'][iosTargetUuidFinal];

// PBXBuildFile for the watch product wrapper (the .app)
const watchProductRef = target.pbxNativeTarget.productReference;
const watchProductName = target.pbxNativeTarget.productReference_comment || (TARGET_NAME + '.app');
const embedBuildFileUuid = proj.generateUuid();
proj.pbxBuildFileSection()[embedBuildFileUuid] = {
  isa: 'PBXBuildFile',
  fileRef: watchProductRef,
  fileRef_comment: watchProductName,
  settings: { ATTRIBUTES: ['RemoveHeadersOnCopy'] },
};
proj.pbxBuildFileSection()[embedBuildFileUuid + '_comment'] = watchProductName + ' in Embed Watch Content';

// PBXCopyFilesBuildPhase — dstPath relative to wrapper, dstSubfolderSpec=16 (Wrapper)
const embedPhaseUuid = proj.generateUuid();
if (!proj.hash.project.objects['PBXCopyFilesBuildPhase']) {
  proj.hash.project.objects['PBXCopyFilesBuildPhase'] = {};
}
proj.hash.project.objects['PBXCopyFilesBuildPhase'][embedPhaseUuid] = {
  isa: 'PBXCopyFilesBuildPhase',
  buildActionMask: 2147483647,
  dstPath: '"$(CONTENTS_FOLDER_PATH)/Watch"',
  // 16 = "Products Directory" — the canonical Xcode value for embedded
  // companion apps (Watch, App Clip, App Extension hosts). Using 1 (Wrapper)
  // causes the destination path to be RESOLVED as
  //   $(BUILT_PRODUCTS_DIR)/$(WRAPPER_NAME)/$(CONTENTS_FOLDER_PATH)/Watch
  // i.e. Release-iphoneos/MegaRadio.app/MegaRadio.app/Watch/ — note the
  // doubled MegaRadio.app, which triggers an Xcode build cycle between
  // ProcessInfoPlist (writes Info.plist into wrapper root) and our
  // copy-files phase. dstSubfolderSpec=16 anchors the destination at
  // $(BUILT_PRODUCTS_DIR), so the resolved path becomes
  //   Release-iphoneos/MegaRadio.app/Watch/MegaRadioWatch.app — correct.
  dstSubfolderSpec: 16,
  files: [
    { value: embedBuildFileUuid, comment: watchProductName + ' in Embed Watch Content' },
  ],
  name: '"Embed Watch Content"',
  runOnlyForDeploymentPostprocessing: 0,
};
proj.hash.project.objects['PBXCopyFilesBuildPhase'][embedPhaseUuid + '_comment'] = 'Embed Watch Content';

// Append the phase to the iOS target's buildPhases list (at the END so it
// runs after Code Sign etc. — Xcode default for embed phases).
iosTargetObj.buildPhases = iosTargetObj.buildPhases || [];
iosTargetObj.buildPhases.push({
  value: embedPhaseUuid,
  comment: 'Embed Watch Content',
});

// ─────────────────────────────────────────────────────────────────────
// 6. Target dependency: iOS app → watch app
// ─────────────────────────────────────────────────────────────────────
log('Adding target dependency: MegaRadio → MegaRadioWatch…');
proj.addTargetDependency(iosTargetUuidFinal, [target.uuid]);

// ─────────────────────────────────────────────────────────────────────
// 7. Save
// ─────────────────────────────────────────────────────────────────────
fs.writeFileSync(PBX_PATH, proj.writeSync().trimEnd() + '\n');

// ─────────────────────────────────────────────────────────────────────
// 8. Patch MegaRadio.xcscheme — add Watch target to BuildAction
//
// Xcode only builds targets listed in scheme.BuildAction. Without this,
// Release-watchos/ never gets built, the iOS embed phase tries to copy
// MegaRadioWatch.app from a non-existent path, and the user gets:
//   "MegaRadioWatch.app couldn't be opened because there is no such file"
// ─────────────────────────────────────────────────────────────────────
function patchScheme() {
  const schemePath = path.join(
    IOS_DIR,
    'MegaRadio.xcodeproj',
    'xcshareddata',
    'xcschemes',
    'MegaRadio.xcscheme'
  );
  if (!fs.existsSync(schemePath)) {
    log('  · scheme file not found, skipping (manual scheme edit required)');
    return;
  }
  let xml = fs.readFileSync(schemePath, 'utf8');
  if (xml.indexOf('BlueprintName = "MegaRadioWatch"') !== -1) {
    log('  · scheme already includes MegaRadioWatch');
    return;
  }
  // Look up the watch target UUID — the existing variable `target.uuid`
  // works during fresh-add; during repair-mode we look it up.
  let watchUuid = null;
  const watchSearch = findTargetByName(TARGET_NAME);
  if (watchSearch) watchUuid = watchSearch.uuid;
  else if (typeof target !== 'undefined') watchUuid = target.uuid;
  if (!watchUuid) {
    log('  · watch target UUID not found — skipping scheme patch');
    return;
  }
  const entry =
    '         <BuildActionEntry\n' +
    '            buildForTesting = "YES"\n' +
    '            buildForRunning = "YES"\n' +
    '            buildForProfiling = "YES"\n' +
    '            buildForArchiving = "YES"\n' +
    '            buildForAnalyzing = "YES">\n' +
    '            <BuildableReference\n' +
    '               BuildableIdentifier = "primary"\n' +
    '               BlueprintIdentifier = "' + watchUuid + '"\n' +
    '               BuildableName = "MegaRadioWatch.app"\n' +
    '               BlueprintName = "MegaRadioWatch"\n' +
    '               ReferencedContainer = "container:MegaRadio.xcodeproj">\n' +
    '            </BuildableReference>\n' +
    '         </BuildActionEntry>';
  // Insert BEFORE </BuildActionEntries> so Watch is built FIRST (iOS embed
  // copies the .app afterwards). Xcode build order respects scheme order.
  const before = '      </BuildActionEntries>';
  if (xml.indexOf(before) === -1) {
    log('  · scheme missing </BuildActionEntries> — unexpected structure, skipping');
    return;
  }
  xml = xml.replace(before, entry + '\n' + before);
  fs.writeFileSync(schemePath, xml);
  log('  · added MegaRadioWatch to MegaRadio.xcscheme BuildAction ✅');
}

log('');
log('Patching Xcode scheme so Release/Archive builds the watch target…');
patchScheme();

// ─────────────────────────────────────────────────────────────────────
// 8b. Ensure MainSceneDelegate.swift / CarPlaySceneDelegate.swift are in
//     the main MegaRadio target's Sources phase.
//
// Expo's `prebuild --clean` regenerates `ios/` from scratch and loses any
// Swift files we hand-rolled (MainSceneDelegate, CarPlaySceneDelegate,
// SiriPlayMediaHandler). When that happens, the iPhone window scene has
// no delegate → black screen after splash. We register them here so
// `yarn ios:setup` resurrects them every time.
// ─────────────────────────────────────────────────────────────────────
function ensureSwiftFileInTarget(filename) {
  // Re-load pbxproj into a fresh xcode parser (older parser instance is
  // stale after our manual mutations above).
  const project = xcode.project(PBX_PATH);
  project.parseSync();
  const pbx = project.hash.project.objects;
  const buildFiles = pbx.PBXBuildFile || {};
  // Already registered?
  for (const k of Object.keys(buildFiles)) {
    const v = buildFiles[k];
    if (typeof v === 'object' && v.fileRef_comment === filename) {
      return false;
    }
  }
  // Find the main app target group ("MegaRadio").
  const groups = pbx.PBXGroup || {};
  let groupKey = null;
  for (const k of Object.keys(groups)) {
    const g = groups[k];
    if (g && g.name === 'MegaRadio' && Array.isArray(g.children)) {
      groupKey = k;
      break;
    }
  }
  if (!groupKey) return false;
  // Find the iPhone app target.
  const targets = pbx.PBXNativeTarget || {};
  let targetUuid = null;
  for (const k of Object.keys(targets)) {
    const t = targets[k];
    if (t && t.name === 'MegaRadio') {
      targetUuid = k;
      break;
    }
  }
  if (!targetUuid) return false;
  project.addSourceFile('MegaRadio/' + filename, { target: targetUuid }, groupKey);
  fs.writeFileSync(PBX_PATH, project.writeSync().trimEnd() + '\n');
  return true;
}

log('');
log('Ensuring iPhone scene + CarPlay Swift sources are registered…');
for (const f of ['PhoneSceneDelegate.swift', 'CarPlaySceneDelegate.swift', 'SiriPlayMediaHandler.swift']) {
  const srcPath = path.join(IOS_DIR, 'MegaRadio', f);
  if (!fs.existsSync(srcPath)) {
    log('  · ' + f + ' missing on disk — skipping (run expo prebuild first?)');
    continue;
  }
  try {
    const added = ensureSwiftFileInTarget(f);
    log('  · ' + f + (added ? ' added to MegaRadio target ✅' : ' already in target'));
  } catch (e) {
    log('  · ' + f + ' failed to register: ' + (e && e.message ? e.message : String(e)));
  }
}

// ─────────────────────────────────────────────────────────────────────
// 9. Run fix-xcode-cycle.js automatically
//
// The RNGoogleMobileAds CocoaPods [CP-User] script phase declares
// inputPaths/outputPaths that reference Info.plist, which creates a build
// cycle with our newly-added Embed Watch Content phase. fix-xcode-cycle.js
// clears those phantom paths and tags every [CP-User] phase with
// `alwaysOutOfDate = 1`, which is the canonical fix recommended by both
// CocoaPods and the React Native Firebase docs.
// ─────────────────────────────────────────────────────────────────────
try {
  log('');
  log('Running fix-xcode-cycle.js to scrub [CP-User] cycles…');
  require('./fix-xcode-cycle.js');
} catch (e) {
  log('  warning: fix-xcode-cycle.js failed: ' + (e && e.message ? e.message : String(e)));
  log('  please run it manually: node scripts/fix-xcode-cycle.js');
}

log('');
log('✅ MegaRadioWatch target added successfully.');
log('');
log('Next steps:');
log('  1. Open ios/MegaRadio.xcworkspace in Xcode');
log('  2. Select the MegaRadioWatch target → Signing & Capabilities');
log('     → set your Team if it didn\'t inherit');
log('  3. Build & Run on the "Apple Watch Series X" simulator');
log('');
log('To remove the target, just delete this script\'s output by either:');
log('  - reverting project.pbxproj via git, or');
log('  - re-running expo prebuild --clean (will rebuild ios/)');
