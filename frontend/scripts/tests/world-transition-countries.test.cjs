const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const rows=[{_id:'a',countrycode:'AT'},{_id:'b',countrycode:'AT'},{_id:'c',countrycode:'FR'},{_id:'d',countrycode:'JP'},{_id:'none'},{_id:'broken',countrycode:'US',broken:true}];
let calls=0;
const mocks={
 './api':{__esModule:true,default:{get:async(_url,options)=>{calls++;assert.equal(options.params.country,undefined,'world preview must not inherit selected Austria');return{data:{stations:rows,totalCount:rows.length}};}}},
 './worldRadioHistory':{},'../utils/worldCountryRotation':{worldCountryKeys:s=>s.countrycode?[s.countrycode.toLowerCase()]:[]},'../utils/worldRadioHistory':{},'../constants/api':{API_ENDPOINTS:{stations:{list:'/stations'}}},'./worldRadioValidation':{eligibleWorldRadio:s=>!s.broken},'../utils/countryScope':{isGlobalCountry:c=>!c},'../utils/carRadioFeed':{uniqueRadios:a=>[...new Map(a.map(s=>[s._id,s])).values()]}
};
const moduleObject={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/services/carRadioService.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,{module:moduleObject,exports:moduleObject.exports,require:id=>{if(!(id in mocks))throw Error(id);return mocks[id];},AbortController,setTimeout,clearTimeout});
(async()=>{const a=await moduleObject.exports.getWorldTransitionRadios();assert.deepEqual(Array.from(a.slice(0,3),s=>s.countrycode),['AT','FR','JP']);assert.ok(a.every(s=>s.countrycode&&!s.broken));await moduleObject.exports.getWorldTransitionRadios();assert.equal(calls,1,'reuse world catalog cache instead of per-pull fetches');console.log('PASS global transition scope, country diversity, invalid-country exclusion and cached catalog reuse');})().catch(error=>{console.error(error);process.exitCode=1;});
