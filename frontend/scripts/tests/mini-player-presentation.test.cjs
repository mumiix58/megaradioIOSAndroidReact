const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/miniPlayerPresentation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:mod,exports:mod.exports});
for(const compact of [false,true]){
 const g=mod.exports.miniPlayerGlowGeometry(compact);
 assert.equal(g.left+g.width/2,g.logoSize/2,'glow centered on the actual artwork independent of controls');
 assert.ok(g.top<g.logoSize&&g.top+g.height>g.logoSize,'halo straddles logo bottom');
 assert.equal(g.logoSize,compact?36:50);
}
const labels=['en','tr','de','fr','es','it','pt','nl','pl','ru','ja','ko','zh','ar'].map(lang=>mod.exports.miniPlayerFailureLabel(lang));
assert.equal(new Set(labels).size,14);assert.ok(labels.every(label=>label&&!label.includes('\n')));assert.equal(mod.exports.miniPlayerFailureLabel('tr-TR'),'Yayın açılamadı');
console.log('PASS logo-relative glow geometry in both sizes and 14-language compact failure labels');

const {miniPlayerFailureKind:kind,miniPlayerOfflineLabel:offline}=mod.exports;
assert.equal(kind('error',true),'offline');
assert.equal(kind('playing',true),'offline');
assert.equal(kind('error',false,true),'reconnect','offline errors cannot become station reports after reconnection');
assert.equal(kind('error',false,false),'station');
assert.equal(kind('paused',false),null);
assert.equal(offline('tr-TR'),'İnternet bağlantısı yok');
console.log('PASS network failure precedence, reconnection guard and station report classification');
