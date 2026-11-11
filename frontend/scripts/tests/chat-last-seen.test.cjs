const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/chatLastSeen.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,Date});
const format=mod.exports.chatLastSeen,t=key=>({chat_today:'Bugün',chat_yesterday:'Dün'})[key];
const now=new Date(2026,10,9,22,0);
assert.equal(format(new Date(2026,10,9,19,3).toISOString(),'tr',t,now),'bugün 19:03');
assert.equal(format(new Date(2026,10,8,19,3).toISOString(),'tr',t,now),'dün 19:03');
assert.equal(format(new Date(2026,10,6,19,3).toISOString(),'tr',t,now),'6 kasım 19:03');
assert.match(format(new Date(2025,10,6,19,3).toISOString(),'tr',t,now),/2025/);
assert.equal(format('bad','tr',t,now),'');
// Yesterday is a calendar date, including DST transitions and month/year boundaries.
assert.match(format(new Date(2026,9,25,1,30).toISOString(),'tr',t,new Date(2026,9,26,0,10)),/^dün/);
assert.match(format(new Date(2025,11,31,23,59).toISOString(),'tr',t,new Date(2026,0,1,0,1)),/^dün/);
console.log('PASS local calendar last-seen labels, dates, years, DST and midnight boundaries');
