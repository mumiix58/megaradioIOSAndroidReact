#!/usr/bin/env node
/**
 * Prepares Samsung Tizen package contents in tvanddesktop/samsung-tizen/dist/
 *
 * Steps:
 *   1. Re-build the TV web-preview bundle (yarn build → dist/)
 *   2. Copy dist/* → tvanddesktop/samsung-tizen/dist/
 *   3. Copy config.xml + icon.png alongside index.html
 *
 * After this script:
 *   • Open Tizen Studio
 *   • File → Import → Tizen Project → root = tvanddesktop/samsung-tizen/dist/
 *   • Right-click project → Build Signed Package → .wgt is produced.
 *
 * Re-run this script every time you change TV web sources.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { rewritePackagedAssets } = require('../_shared/packaged-assets');
const { activateLegacyEntry } = require('../_shared/legacy-entry');

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
// Read version from config.xml so the embedded version + manifest are in sync,
// and the UpdateBanner can compare against /api/tv/version.
let tizenVersion;
try {
  const cfg = fs.readFileSync(path.join(__dirname, 'config.xml'), 'utf8');
  const m = cfg.match(/version="(\d+\.\d+\.\d+)"/);
  if (!m) throw new Error('Missing Samsung widget version');
  tizenVersion = m[1];
} catch (error) {
  console.error('Cannot determine Samsung package version:', error.message);
  process.exit(1);
}
console.log('  embedded VITE_APP_VERSION =', tizenVersion);
try {
  const shell = process.platform === 'win32' ? true : (fs.existsSync('/bin/bash') ? '/bin/bash' : true);
  execSync('yarn build', {
    cwd: TV_SRC_DIR,
    stdio: 'inherit',
    shell,
    env: { ...process.env, VITE_APP_VERSION: tizenVersion },
  });
} catch (e) {
  console.error('TV build failed. Refusing to package an old or partial bundle.');
  process.exit(1);
}

console.log('▸ Cleaning output:', OUT_DIR);
rmrf(OUT_DIR);

const APP_DIR = path.join(OUT_DIR, 'app');
console.log('▸ Copying TV bundle → samsung-tizen/dist/app/ (local fallback)');
copyDir(TV_DIST, APP_DIR);

// version.json for the bundled fallback (so it self-identifies offline too).
fs.writeFileSync(
  path.join(APP_DIR, 'version.json'),
  JSON.stringify({ version: tizenVersion, killSwitch: false, builtAt: new Date().toISOString() }, null, 2)
);

// Remote-update bootstrap → root index.html (CDN base injected from cdn-config.json).
console.log('▸ Writing remote-update bootstrap (index.html)');
const cdnCfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'cdn-config.json'), 'utf8'));
let boot = fs.readFileSync(path.join(__dirname, '..', 'remote-bootstrap.html'), 'utf8');
boot = boot.replace(/__CDN_BASE__/g, cdnCfg.cdnBase);
boot = boot.replace(/__APP_VERSION__/g, tizenVersion);
fs.writeFileSync(path.join(OUT_DIR, 'index.html'), boot);
console.log('  CDN base =', cdnCfg.cdnBase);

console.log('▸ Copying Tizen manifest + icon');
fs.copyFileSync(path.join(__dirname, 'config.xml'), path.join(OUT_DIR, 'config.xml'));
fs.copyFileSync(path.join(__dirname, 'icon.png'),   path.join(OUT_DIR, 'icon.png'));

// Tizen Studio'nun "Import Tizen Project" wizard'ı bir klasörü algılamak için
// Eclipse-tarzı .project + .tproject meta dosyalarına ihtiyaç duyar. Bunlar
// olmadan import wizard "Project list" alanını boş gösterir.
console.log('▸ Adding Eclipse/Tizen meta files (.project, .tproject)');
fs.copyFileSync(path.join(__dirname, '.project.template'),  path.join(OUT_DIR, '.project'));
fs.copyFileSync(path.join(__dirname, '.tproject.template'), path.join(OUT_DIR, '.tproject'));

// Rewrite absolute /api/* paths so the bundle works inside file:// containers.
// IMPORTANT — must NOT double-prefix already-absolute URLs of ANY origin
// (themegaradio.com, backend.radiolise.com, third-party stream domains, etc.).
// We park EVERY scheme://host/api/... match before doing the relative-/api/
// rewrite, then restore them verbatim afterwards.
console.log('▸ Rewriting absolute /api/* asset paths in HTML/CSS (NEVER touch JS)...');

/**
 * Rewrite HTML / CSS only.
 *
 * CRITICAL: We must NEVER do text rewriting on the minified JS bundle.
 * The JS bundle contains things that look like `/api/` paths but are not —
 * regex literals (e.g. `/^\/api/`), comments, template strings, and
 * concatenation operators. Naive find-and-replace corrupts these into
 * invalid syntax (`/^\https://api.themegaradio.co...` — broken regex →
 * "Unexpected token ','" crash on Tizen TV).
 *
 * The runtime code in AuthContext.tsx / useSubscriptionLink.ts /
 * useSubscriptionStatus.ts already does platform detection at runtime via
 * `detectApiBase()`, returning `https://api.themegaradio.com` when
 * `window.location.hostname` is empty (which is always true under file://
 * inside Tizen/WebOS), so JS doesn't need any rewrite at all. The only
 * thing we must fix is asset paths in `index.html` and CSS `url(...)` refs
 * that Vite emits with the absolute `/api/tv-app/` base — those become
 * 404s under file://.
 */
function rewriteFile(filePath) {
  let s = fs.readFileSync(filePath, 'utf8');

  // Asset base prefix → relative path.
  s = rewritePackagedAssets(s, filePath, APP_DIR);

  fs.writeFileSync(filePath, s);
}

function walkAndRewrite(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walkAndRewrite(p);
    // HTML + CSS only. JS is OFF LIMITS (see comment in rewriteFile).
    else if (/\.(html|css)$/.test(entry.name)) rewriteFile(p);
  }
}
walkAndRewrite(APP_DIR);
const localEntry = path.join(APP_DIR, 'index.html');
fs.writeFileSync(localEntry, activateLegacyEntry(fs.readFileSync(localEntry, 'utf8')));
require('../apple-tv-and-macos/web-preview/compat/check-legacy.cjs').checkLegacy(APP_DIR);

console.log('\n✅ Tizen project ready at:', OUT_DIR);
console.log('   Import this folder into Tizen Studio:');
console.log('   File → Import → Tizen → Tizen Project → next →');
console.log('   "Select root directory" =', OUT_DIR);
