const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const base = path.resolve(__dirname, '../frontend/tvanddesktop/apple-tv-and-macos/web-preview');
const {legacyCss} = require(path.join(base,'compat/legacy-css.cjs'));
const postcss = require(path.join(base,'node_modules/postcss'));
test('old-engine backdrop keeps the original transparent-to-dark fade without cross-rule CSS variables', () => {
 const input='.bg-gradient-to-b{background-image:linear-gradient(to bottom,var(--tw-gradient-stops))}.from-example{--tw-gradient-from:rgba(14,14,14,0) var(--tw-gradient-from-position)}';
 const generated=postcss.parse(legacyCss(input));
 const fades=[];
 generated.walkRules(rule=>{if(rule.selector.includes('[class~="from-[rgba(14,14,14,0)]"]'))fades.push(rule)});
 assert.equal(fades.length,2);
 for(const [i,stops] of [['0.88%','48.611%'],['18.704%','25.787%']].entries()){
  assert.ok(fades[i].selector.startsWith('html.mr-legacy-css '));
  assert.ok(fades[i].selector.includes('[class~="from-['+stops[0]+']"]'));
  assert.ok(fades[i].selector.includes('[class~="to-['+stops[1]+']"]'));
  assert.equal(fades[i].nodes[0].value,'linear-gradient(to bottom, rgba(14,14,14,0) '+stops[0]+', rgb(14,14,14) '+stops[1]+')');
  assert.doesNotMatch(fades[i].toString(),/var\(/);
 }
 assert.ok(!generated.nodes.some(n=>n.selector==='.bg-gradient-to-b'), 'does not override the modern utility globally');
});
