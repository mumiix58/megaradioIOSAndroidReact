#!/usr/bin/env node
/* eslint-disable no-console */
//
// create-tvos-project.js
//
// Generates `MegaRadioTV.xcodeproj` for Apple TV (tvOS 17+) and macOS 14+
// from the single source of truth `project.yml`.
//
// ⚠️ THIS SCRIPT IS COMPLETELY INDEPENDENT FROM:
//   - frontend/ios/MegaRadio.xcodeproj            (iOS app + watchOS)
//   - frontend/scripts/add-watchos-target.js      (iOS / WatchOS automation)
//   - frontend/ios/Podfile                        (React Native pods)
//
// It only writes files inside:
//   frontend/tvanddesktop/apple-tv-and-macos/ios-tvos/
//
// Idempotent: safe to run any number of times — regenerates the project
// from project.yml without losing your code or assets.
//
// Powered by `xcodegen` (https://github.com/yonaskolb/XcodeGen) —
// the same project generator used by Spotify, Airbnb, Mercedes-Benz etc.
//

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const TVOS_DIR = path.resolve(__dirname, '..', 'tvanddesktop', 'apple-tv-and-macos', 'ios-tvos');
const PROJECT_YML = path.join(TVOS_DIR, 'project.yml');
const PROJECT_OUT = path.join(TVOS_DIR, 'MegaRadioTV.xcodeproj');

// ────────────────────────────────────────────────────────────────────────
// Pretty logging
// ────────────────────────────────────────────────────────────────────────
function log(msg) { console.log('\x1b[36m[create-tvos-project]\x1b[0m ' + msg); }
function warn(msg) { console.warn('\x1b[33m[create-tvos-project]\x1b[0m ' + msg); }
function err(msg) { console.error('\x1b[31m[create-tvos-project]\x1b[0m ' + msg); }
function ok(msg) { console.log('\x1b[32m[create-tvos-project]\x1b[0m ' + msg); }

// ────────────────────────────────────────────────────────────────────────
// Sanity checks
// ────────────────────────────────────────────────────────────────────────
function preflight() {
  if (!fs.existsSync(PROJECT_YML)) {
    err('Missing ' + PROJECT_YML);
    err('Did you delete the project.yml? Restore it from git.');
    process.exit(1);
  }
  // Make sure we're not accidentally running on Linux / inside CI without Xcode.
  // xcodegen is Mac-only (it depends on Foundation + PlistBuddy).
  if (process.platform !== 'darwin') {
    warn('xcodegen requires macOS. On this OS (' + process.platform + ') we cannot generate the .xcodeproj.');
    warn('This script is only meaningful when run on the Mac that will compile MegaRadioTV.');
    warn('Skipping with no error (this is fine on Linux CI runners).');
    process.exit(0);
  }
}

// ────────────────────────────────────────────────────────────────────────
// xcodegen detection + auto-install
// ────────────────────────────────────────────────────────────────────────
function hasXcodegen() {
  const r = spawnSync('xcodegen', ['--version'], { stdio: 'pipe' });
  return r.status === 0;
}

function installXcodegen() {
  log('xcodegen is not installed. Trying to install via Homebrew…');
  // Check if brew exists
  const brewCheck = spawnSync('which', ['brew'], { stdio: 'pipe' });
  if (brewCheck.status !== 0) {
    err('Homebrew is not installed.');
    err('Install Homebrew first (https://brew.sh), then run:');
    err('  brew install xcodegen');
    err('and re-run `yarn tvos:setup`.');
    process.exit(1);
  }
  try {
    execSync('brew install xcodegen', { stdio: 'inherit' });
    ok('xcodegen installed via Homebrew.');
  } catch (e) {
    err('brew install xcodegen failed. Install manually:');
    err('  brew install xcodegen');
    process.exit(1);
  }
}

// ────────────────────────────────────────────────────────────────────────
// Generate the .xcodeproj
// ────────────────────────────────────────────────────────────────────────
function generate() {
  require('./prepare-tvos-assets');
  log('Generating MegaRadioTV.xcodeproj from project.yml…');
  const r = spawnSync('xcodegen', ['generate', '--spec', PROJECT_YML, '--project', TVOS_DIR], {
    stdio: 'inherit',
    cwd: TVOS_DIR,
  });
  if (r.status !== 0) {
    err('xcodegen failed with exit code ' + r.status);
    err('Check that project.yml is valid YAML and all referenced source files exist.');
    process.exit(r.status);
  }
}

// ────────────────────────────────────────────────────────────────────────
// Post-generate: verify the project is well-formed
// ────────────────────────────────────────────────────────────────────────
function verify() {
  const pbxproj = path.join(PROJECT_OUT, 'project.pbxproj');
  if (!fs.existsSync(pbxproj)) {
    err('Expected output ' + pbxproj + ' was not produced.');
    process.exit(1);
  }
  const stat = fs.statSync(pbxproj);
  log('project.pbxproj produced (' + (stat.size / 1024).toFixed(1) + ' KB)');

  // Surface a Mac-friendly hint if no `Info.plist` was generated.
  const tvInfo = path.join(TVOS_DIR, 'Info.plist');
  const macInfo = path.join(TVOS_DIR, 'Info-Mac.plist');
  if (!fs.existsSync(tvInfo)) {
    warn('Note: Info.plist did not exist before generation — xcodegen created it from project.yml.');
  }
  if (!fs.existsSync(macInfo)) {
    warn('Note: Info-Mac.plist did not exist before generation — xcodegen created it from project.yml.');
  }
}

// ────────────────────────────────────────────────────────────────────────
// Friendly next-steps banner
// ────────────────────────────────────────────────────────────────────────
function banner() {
  console.log('');
  console.log('======================================================');
  ok('MegaRadioTV.xcodeproj is ready!');
  console.log('======================================================');
  console.log('Open it:');
  console.log('  open ' + path.relative(process.cwd(), PROJECT_OUT));
  console.log('');
  console.log('Targets in the project:');
  console.log('  • MegaRadioTV   — Apple TV (tvOS 17+)');
  console.log('  • MegaRadioMac  — macOS 14+ (native AppKit-flavoured app)');
  console.log('');
  console.log('Choose the scheme in Xcode and Cmd+R to run.');
  console.log('');
  console.log('To regenerate after editing project.yml:');
  console.log('  yarn tvos:setup');
  console.log('======================================================');
  console.log('');
}

// ────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────
function main() {
  preflight();
  if (!hasXcodegen()) {
    installXcodegen();
  } else {
    log('xcodegen detected — skipping install.');
  }
  generate();
  verify();
  banner();
}

main();
