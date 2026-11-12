const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const base = path.resolve(__dirname, '../frontend/tvanddesktop/apple-tv-and-macos/web-preview');
const ts = require(path.join(base, 'node_modules/typescript'));
const source = fs.readFileSync(path.join(base, 'src/lib/apiOrigin.ts'), 'utf8');
function selector(navigator) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText, {module,exports:module.exports,navigator});
  return module.exports.getProductionApiOrigin;
}
test('only actual old LG engine generations select the existing compatible HTTPS first-party API alias', () => {
  const origin = selector();
  assert.equal(origin('Mozilla/5.0 (Web0S; Linux/SmartTV) QtWebEngine/5.2.1 Chrome/38.0.2125.122 WebAppManager'), 'https://themegaradio.com');
  assert.equal(origin('Mozilla/5.0 (webOS; Linux/SmartTV) Chrome/53.0.2785.34 WebAppManager'), 'https://themegaradio.com');
  for (const ua of ['', 'Chrome/38.0.1', 'Tizen Chrome/53.0.1', 'Web0S Chrome/68.0.3440.106', 'Web0S Chrome/120.0.1']) {
    assert.equal(origin(ua), 'https://api.themegaradio.com');
  }
});
test('runtime selection uses native UA and never accepts a configurable/arbitrary origin', () => {
  assert.equal(selector({userAgent:'Web0S Chrome/38.0.2125.122'})(), 'https://themegaradio.com');
  assert.equal(selector()(), 'https://api.themegaradio.com');
  assert.equal(selector()('Web0S Chrome/38.0.1 https://untrusted.example'), 'https://themegaradio.com');
});
