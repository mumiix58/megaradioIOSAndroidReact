const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const mod={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/popularStationRotation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:mod,exports:mod.exports});
const next=mod.exports.createPopularStationRotation();
const pool=Array.from({length:20},(_,i)=>String(i));
const visits=Array.from({length:5},()=>Array.from(next('France',pool)));
assert.equal(new Set(visits.flat()).size,20,'all 20 recommendations appear before repetition');
assert.deepEqual(visits[0],pool.slice(0,4),'initial visit preserves API popularity order');
assert.deepEqual(Array.from(next('global',pool)),pool.slice(0,4),'Global has an independent deck');
assert.deepEqual(Array.from(next('France',pool)),pool.slice(0,4),'cycle resumes only after all twenty');
for(const length of [4,7,9,18,20]){
 let previous=[];
 const rotate=mod.exports.createPopularStationRotation();
 for(let visit=0;visit<12;visit++){
  const batch=Array.from(rotate('scope',pool.slice(0,length)));
  assert.equal(new Set(batch).size,batch.length);
  if(length>=8)assert.equal(batch.filter(id=>previous.includes(id)).length,0,'adjacent visits do not repeat with a sufficient pool');
  previous=batch;
 }
}
assert.deepEqual(Array.from(next('small',['a','a','b',''])),['a','b']);
assert.deepEqual(Array.from(next('France',['new1','new2','new3','new4'])),['new1','new2','new3','new4'],'a changed catalog discards old IDs');
console.log('PASS country/Global isolation, top-20 fairness, wrap-around, small pools, duplicate IDs and refreshed catalog');

let snapshot;
const firstLaunch=mod.exports.createPopularStationRotation(32,[],value=>{snapshot=JSON.parse(JSON.stringify(value));});
firstLaunch('France',pool);
const secondLaunch=mod.exports.createPopularStationRotation(32,snapshot);
assert.deepEqual(Array.from(secondLaunch('France',pool)),pool.slice(4,8),'app restart continues the saved country deck');
assert.deepEqual(Array.from(secondLaunch('global',pool)),pool.slice(0,4));
console.log('PASS app restart restores the next batch without mixing Global/country');

for(const country of [null,undefined,'','  ','Unknown','UNKNOWN','n/a','-']) assert.equal(mod.exports.hasPopularStationCountry({country}),false);
for(const country of ['France','Türkiye','The United States Of America']) assert.equal(mod.exports.hasPopularStationCountry({country}),true);
console.log('PASS missing/Unknown countries excluded; named countries remain eligible');

const {buildGlobalPopularPool,popularCountryKey}=mod.exports;
// A heavily skewed popularity list must not produce four US stations.
const skewed=Array.from({length:60},(_,i)=>({_id:`us-${i}`,country:'The United States Of America'}));
for(const country of ['Germany','Hungary','France','UK','Türkiye','Spain','Italy','Japan'])skewed.push({_id:country,country});
const globalPool=Array.from(buildGlobalPopularPool(skewed,20));
assert.equal(globalPool.length,20);
assert.equal(new Set(globalPool.slice(0,4).map(popularCountryKey)).size,4);
const globalIds=globalPool.map(s=>s._id),countries=new Map(globalPool.map(s=>[s._id,popularCountryKey(s)]));
const diverse=mod.exports.createPopularStationRotation();
for(let visit=0;visit<30;visit++){
 const batch=Array.from(diverse('global',globalIds,4,countries));
 assert.equal(batch.length,4);
 assert.equal(new Set(batch.map(id=>countries.get(id))).size,4,`visit ${visit}: four unique countries`);
}
assert.equal(popularCountryKey({country:'Turkey'}),popularCountryKey({country:'Türkiye'}));
assert.equal(popularCountryKey({country:'USA'}),popularCountryKey({country:'The United States Of America'}));
const sparse=new Map([['a','france'],['b','france'],['c','germany']]);
assert.equal(diverse('sparse',['a','b','c'],4,sparse).length,2,'never fill a missing country with a duplicate');
console.log('PASS Global diversity across 30 visits, skewed pools, country aliases and strict sparse fallback');

assert.equal(popularCountryKey({country:'Iran'}),popularCountryKey({country:'Islamic Republic Of Iran'}));
