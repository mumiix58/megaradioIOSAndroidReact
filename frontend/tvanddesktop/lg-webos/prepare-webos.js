#!/usr/bin/env node
/**
 * Prepares LG WebOS package contents in tvanddesktop/lg-webos/dist/
 *
 * Steps:
 *   1. Re-build the TV web-preview bundle (yarn build → dist/)
 *   2. Copy dist/* → tvanddesktop/lg-webos/dist/
 *   3. Copy appinfo.json + icon.png + largeIcon.png
 *
 * After this script, package with ares-package CLI (installed with webOS TV CLI):
 *   $ node prepare-webos.js --resolution 1280x720  # or 1920x1080
 *   $ ares-package tvanddesktop/lg-webos/dist
 *   → produces com.themegaradio.app_<appinfo version>_all.ipk in the current directory.
 *
 * Install to dev TV:
 *   $ ares-setup-device --add LG_TV --info "{...}"   (one time)
 *   $ ares-install --device LG_TV com.themegaradio.app_<version>_all.ipk
 *
 * For LG Content Store submission: upload the .ipk on http://seller.lgappstv.com
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { rewritePackagedAssets } = require('../_shared/packaged-assets');
const { activateLegacyEntry } = require('../_shared/legacy-entry');
const { createWebosManifest } = require('../_shared/webos-manifest.cjs');

const REPO_ROOT  = path.resolve(__dirname, '..', '..', '..');
const TV_SRC_DIR = path.join(REPO_ROOT, 'frontend', 'tvanddesktop', 'apple-tv-and-macos', 'web-preview');
// Vite outputs to /backend/static/tv-preview (configured in web-preview/vite.config.ts)
const TV_DIST    = path.join(REPO_ROOT, 'backend', 'static', 'tv-preview');
const OUT_DIR    = path.join(__dirname, 'dist');

function rmrf(p) { if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true }); }
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

console.log('▸ Building TV web bundle...');
const sourceAppInfo = JSON.parse(fs.readFileSync(path.join(__dirname, 'appinfo.json'), 'utf8'));
const resolutionArg = process.argv.indexOf('--resolution');
const appInfo = createWebosManifest(sourceAppInfo, resolutionArg < 0 ? undefined : process.argv[resolutionArg + 1]);
if (resolutionArg >= 0 && !process.argv[resolutionArg + 1]) throw new Error('Missing --resolution value');
const webosVersion = appInfo.version;
if (!webosVersion) throw new Error('Missing webOS app version');
try {
  const shell = process.platform === 'win32' ? true : (fs.existsSync('/bin/bash') ? '/bin/bash' : true);
  execSync('yarn build', { cwd: TV_SRC_DIR, stdio: 'inherit', shell,
    env: { ...process.env, VITE_APP_VERSION: webosVersion } });
} catch (e) {
  console.error('TV build failed. Refusing to package an old or partial bundle.');
  process.exit(1);
}

console.log('▸ Cleaning output:', OUT_DIR);
rmrf(OUT_DIR);

const APP_DIR = path.join(OUT_DIR, 'app');
console.log('▸ Copying TV bundle → lg-webos/dist/app/ (local fallback)');
copyDir(TV_DIST, APP_DIR);

fs.writeFileSync(
  path.join(APP_DIR, 'version.json'),
  JSON.stringify({ version: webosVersion, killSwitch: false, builtAt: new Date().toISOString() }, null, 2)
);

console.log('▸ Writing remote-update bootstrap (index.html)');
const cdnCfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'cdn-config.json'), 'utf8'));
let boot = fs.readFileSync(path.join(__dirname, '..', 'remote-bootstrap.html'), 'utf8').replace(/__CDN_BASE__/g, cdnCfg.cdnBase).replace(/__APP_VERSION__/g, webosVersion);
fs.writeFileSync(path.join(OUT_DIR, 'index.html'), boot);
console.log('  CDN base =', cdnCfg.cdnBase);

console.log('▸ Copying WebOS manifest + icons');
fs.writeFileSync(path.join(OUT_DIR, 'appinfo.json'), JSON.stringify(appInfo, null, 2) + '\n');
fs.copyFileSync(path.join(__dirname, 'icon.png'),      path.join(OUT_DIR, 'icon.png'));
fs.copyFileSync(path.join(__dirname, 'largeIcon.png'), path.join(OUT_DIR, 'largeIcon.png'));
fs.copyFileSync(path.join(__dirname, 'splash.png'),    path.join(OUT_DIR, 'splash.png'));

// Rewrite HTML / CSS ONLY. JS is OFF LIMITS — see prepare-tizen.js for the
// full explanation. Naive text rewrite on minified JS breaks regex literals
// like `/^\/api/` (becomes invalid regex → "Unexpected token ','" on TV).
// Runtime detectApiBase() in AuthContext + subscription hooks already
// returns https://api.themegaradio.com under file://, so no JS rewrite
// is needed; we only need to fix asset paths in HTML/CSS.
console.log('▸ Rewriting absolute /api/* asset paths in HTML/CSS (NEVER touch JS)...');
function rewriteFile(filePath) {
  let s = fs.readFileSync(filePath, 'utf8');
  s = rewritePackagedAssets(s, filePath, APP_DIR);
  fs.writeFileSync(filePath, s);
}
function walkAndRewrite(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walkAndRewrite(p);
    else if (/\.(html|css)$/.test(entry.name)) rewriteFile(p);
  }
}
walkAndRewrite(APP_DIR);
const localEntry = path.join(APP_DIR, 'index.html');
fs.writeFileSync(localEntry, activateLegacyEntry(fs.readFileSync(localEntry, 'utf8')));
require('../apple-tv-and-macos/web-preview/compat/check-legacy.cjs').checkLegacy(APP_DIR);

console.log('\n✅ WebOS project ready at:', OUT_DIR);
console.log('   Package with:');
console.log('     ares-package', OUT_DIR);
console.log('   Install on dev TV:');
console.log(`     ares-install --device LG_TV ${appInfo.id}_${webosVersion}_all.ipk`);
