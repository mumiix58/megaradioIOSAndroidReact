// Execute real shared TV source modules in the existing isolated API harnesses.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const base = path.resolve(__dirname, '../frontend/tvanddesktop/apple-tv-and-macos/web-preview');
const ts = require(path.join(base, 'node_modules/typescript'));
function tvSourceRequire(id) {
  if (id !== '../lib/apiOrigin' && id !== './apiOrigin' && id !== '@/lib/apiOrigin') {
    throw new Error('Unexpected isolated TV source import: ' + id);
  }
  const module = {exports:{}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(base, 'src/lib/apiOrigin.ts'), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText, {module,exports:module.exports});
  return module.exports;
}
module.exports = {tvSourceRequire};
