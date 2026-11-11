const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { rewritePackagedAssets } = require('../../_shared/packaged-assets');
function prepareRenderer() {
  const root = path.resolve(__dirname, '..');
  const source = path.resolve(root, '../apple-tv-and-macos/web-preview');
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'megaradio-renderer-'));
  const target = path.join(root, 'renderer');
  const vite = path.join(source, 'node_modules', 'vite', 'bin', 'vite.js');
  execFileSync(process.execPath, [vite, 'build', '--base', './', '--outDir', dist], {
    cwd: source, stdio: 'inherit', env: { ...process.env, TV_BASE_PATH: './', TV_BUILD_TARGET: 'desktop', VITE_APP_VERSION: require('../package.json').version },
  });
  if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('Desktop renderer build has no index.html');
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(dist, target, { recursive: true });
  function walk(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name);
      if (item.isDirectory()) walk(file);
      else if (/\.(html|css)$/.test(item.name)) fs.writeFileSync(file, rewritePackagedAssets(fs.readFileSync(file, 'utf8'), file, target));
    }
  }
  walk(target);
  const index = path.join(target, 'index.html');
  const base = '<script>window.__MR_ASSET_BASE__ = new URL("./", window.location.href).href;</script>';
  fs.writeFileSync(index, fs.readFileSync(index, 'utf8').replace('<head>', '<head>' + base));
  fs.rmSync(dist, { recursive: true, force: true });
  return target;
}
if (require.main === module) prepareRenderer();
module.exports = { prepareRenderer };
