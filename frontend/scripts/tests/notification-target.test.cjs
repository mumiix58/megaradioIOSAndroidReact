const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/notificationTarget.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:mod,exports:mod.exports});
const target=mod.exports.notificationTarget;
// Actual server favorite additions and removals differ in type, but both carry stationId.
for(const type of ['new_station','favorite_station','favorite_update','system'])assert.equal(target({type,data:{stationId:'radio-a',stationName:'Radio A'}}).kind,'station');
assert.equal(target({type:'favorite_station',data:{stationId:'old-id',stationSlug:'current-slug'}}).id,'current-slug');
assert.equal(target({type:'new_station',station:{_id:'nested-radio'}}).id,'nested-radio');
assert.equal(target({type:'system',data:{station:{_id:'payload-radio'}}}).id,'payload-radio');
assert.equal(target({type:'follow',fromUserId:{_id:'user-a',fullName:'Name'}}).id,'user-a');
assert.equal(target({type:'unfollow',fromUserId:'user-b'}).kind,'profile');
assert.equal(target({type:'new_message',data:{userId:'user-c',stationId:'attached-radio'}}).kind,'chat');
assert.equal(target({type:'system',message:'News without a target'}),null);
assert.equal(target({type:'new_station',data:{stationId:'  '}}),null);
console.log('PASS server favorite add/remove payloads, slug priority, nested station/user payloads, chat routing and missing targets');

const timeModule={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/notificationTime.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:timeModule,exports:timeModule.exports,Intl});
const time=timeModule.exports.notificationTime,now=Date.parse('2026-11-11T12:00:00Z');
assert.equal(time('invalid','en',now),'');
assert.equal(time('2026-11-11T11:57:00Z','en',now),'3 min');
assert.equal(time('2026-11-11T09:30:00Z','en',now),'2 hr');
assert.equal(time('2026-11-11T12:01:00Z','en',now),'now');
assert.match(time('2026-11-11T11:57:00Z','tr',now),/3.*dk/);
for(const language of ['de','zh','ar','ja'])assert.ok(time('2026-11-11T11:57:00Z',language,now).length>0);
console.log('PASS compact localized notification time, boundaries, future clock skew and invalid dates');
