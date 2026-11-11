const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
function load(path,mocks){const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,{module:mod,exports:mod.exports,require:id=>mocks[id]});return mod.exports;}
const helper=load('src/utils/profileDiscovery.ts',{}),calls=[];
let user={_id:'owner',name:'Listener',preferences:{language:'tr',playAtLogin:'LAST_PLAYED'}};
let fail=false,unconfirmed=false,otherOwner=false,switchOwner=false;
const auth={getState:()=>({user,isAuthenticated:true,updateUser:async value=>{user=value}})};
const api={put:async(path,body)=>{calls.push({path,body});if(fail)throw Error('offline');const saved={...user,preferences:{...user.preferences,...body.preferences}};if(unconfirmed)delete saved.preferences.profileGender;if(otherOwner)saved._id='other';if(switchOwner)user={_id:'different',name:'Other'};return {data:{user:saved}}}};
const {saveProfileDiscoveryPreferences:save}=load('src/services/profileDiscoveryPreferences.ts',{'./api':api,'../store/authStore':{useAuthStore:auth},'../utils/profileDiscovery':helper});
(async()=>{
 await save({profileGender:'female'});assert.equal(user.preferences.profileGender,'female');assert.equal(user.preferences.language,'tr');assert.equal(calls[0].body.preferences.profileGender,'female');assert.equal(Object.keys(calls[0].body.preferences).length,1);
 await save({profileCountryCode:'AT'});assert.equal(user.preferences.profileCountryCode,'AT');assert.equal(user.preferences.playAtLogin,'LAST_PLAYED');
 await save({profileCountryCode:null});assert.equal(user.preferences.profileCountryCode,null);
 fail=true;await assert.rejects(()=>save({profileGender:'male'}));assert.equal(user.preferences.profileGender,'female');fail=false;
 unconfirmed=true;await assert.rejects(()=>save({profileGender:'male'}));assert.equal(user.preferences.profileGender,'female');unconfirmed=false;
 otherOwner=true;await assert.rejects(()=>save({profileCountryCode:'DE'}));assert.equal(user.preferences.profileCountryCode,null);otherOwner=false;
 await assert.rejects(()=>save({profileGender:'guessed'}));
 switchOwner=true;await assert.rejects(()=>save({profileCountryCode:'DE'}));assert.equal(user._id,'different');
 for(const language of ['en','tr','de','fr','es','it','pt','nl','pl','ru','ja','ko','zh','ar'])assert.ok(helper.profileDiscoveryLabels(language).country);
 const selector=fs.readFileSync('src/components/CountrySelectorModal.tsx','utf8');assert.ok(selector.includes('if (!selectionOnly) await setCountryManual'));
 console.log('PASS sparse confirmed saves, unrelated preferences retained, clearing, failures, owner switch, 14 languages and independent browsing-country mode');
})().catch(error=>{console.error(error);process.exitCode=1});
