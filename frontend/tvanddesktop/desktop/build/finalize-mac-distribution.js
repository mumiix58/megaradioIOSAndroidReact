// Run after Apple accepts the DMG and its ticket has been stapled to both
// the DMG and the app. Notarization changes bytes, so regenerate updater
// hashes/blockmaps from the final files, never from the pre-notarized build.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { buildBlockMap } = require('app-builder-lib/out/targets/blockmap/blockmap');
const root = path.resolve(__dirname, '..');
const version = require('../package.json').version;
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid release version');
const dist = path.join(root, 'dist');
const app = path.join(dist, 'mac-universal', 'MegaRadio.app');
const dmg = path.join(dist, `MegaRadio-${version}-universal.dmg`);
const zip = path.join(dist, `MegaRadio-${version}-universal-mac.zip`);

async function main() {
  for (const artifact of [app, dmg]) {
    execFileSync('xcrun', ['stapler', 'validate', artifact], { stdio: 'inherit' });
  }
  execFileSync('spctl', ['--assess', '--type', 'execute', app], { stdio: 'inherit' });
  const temporaryZip = zip.replace(/\.zip$/, '.tmp.zip');
  fs.rmSync(temporaryZip, { force: true });
  execFileSync('ditto', ['-c', '-k', '--keepParent', app, temporaryZip], { stdio: 'inherit' });
  fs.renameSync(temporaryZip, zip);
  const files = await Promise.all([zip, dmg].map(async file => ({
    url: path.basename(file),
    ...await buildBlockMap(file, 'gzip', `${file}.blockmap`),
  })));
  const yaml = [
    `version: ${version}`, 'files:',
    ...files.flatMap(file => [`  - url: ${file.url}`, `    sha512: ${file.sha512}`, `    size: ${file.size}`]),
    `path: ${files[0].url}`, `sha512: ${files[0].sha512}`,
    `releaseDate: '${new Date().toISOString()}'`, '',
  ].join('\n');
  fs.writeFileSync(path.join(dist, 'latest-mac.yml'), yaml);
  console.log('Notarized Mac installer and ZIP updater metadata are ready.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
