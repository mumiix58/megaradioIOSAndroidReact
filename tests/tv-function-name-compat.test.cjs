const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const base = path.resolve(__dirname, '../frontend/tvanddesktop/apple-tv-and-macos/web-preview');
const { compatibleDependencyFunctionNames } = require(path.join(base, 'compat/dependency-function-names.cjs'));
const modulePath = require.resolve(path.join(base, 'node_modules/@radix-ui/react-toast/dist/index.mjs'));
const actual = fs.readFileSync(modulePath, 'utf8');
const helper = actual.match(/var __defProp = Object\.defineProperty;\s*var __name = [^\n]+;/)[0];
function run(source, expression) {
  return vm.runInNewContext(source + '\n' + expression);
}
test('actual published Radix helper reproduces the native Chromium 38 non-configurable function name failure', () => {
  assert.throws(() => run(helper, `var fn = function original(){}; Object.defineProperty(fn, 'name', {configurable:false}); __name(fn, 'renamed');`), /Cannot redefine property: name/);
});
test('scoped build transform preserves a non-configurable function name and returns the same callable', () => {
  const transformed = compatibleDependencyFunctionNames(helper, modulePath);
  assert.ok(transformed);
  assert.equal(run(transformed, `var fn=function original(){return 42}; Object.defineProperty(fn,'name',{configurable:false}); var named=__name(fn,'renamed'); named===fn && named()===42 && named.name==='original' && Object.getOwnPropertyDescriptor(named,'name').configurable===false;`), true);
});
test('modern configurable function names retain the dependency helper behavior', () => {
  const transformed = compatibleDependencyFunctionNames(helper, modulePath);
  assert.equal(run(transformed, `var fn=function original(){}; __name(fn,'renamed')===fn && fn.name==='renamed' && Object.getOwnPropertyDescriptor(fn,'name').configurable;`), true);
});
test('unrelated descriptor failures and code outside the exact Radix helper remain unchanged', () => {
  const transformed = compatibleDependencyFunctionNames(helper, modulePath);
  assert.throws(() => run(transformed, `var obj={}; Object.defineProperty(obj,'name',{value:'locked',configurable:false}); __name(obj,'renamed');`), /Cannot redefine property: name/);
  assert.equal(compatibleDependencyFunctionNames(helper, '/app/src/ordinary.js'), null);
  assert.equal(compatibleDependencyFunctionNames('Object.defineProperty(obj,"name",descriptor)', modulePath), null);
  assert.equal(run(transformed, `var before=Object.defineProperty; __name(function original(){},'renamed'); before===Object.defineProperty;`), true);
});
