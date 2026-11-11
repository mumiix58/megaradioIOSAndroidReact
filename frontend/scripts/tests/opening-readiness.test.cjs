const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file){const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:mod,exports:mod.exports});return mod.exports;}
const {canRevealStartup}=load('src/utils/startupReadiness.ts');
const keys=['fonts','country','auth','locale','route'];
for(let bits=0;bits<32;bits++){
 const state=Object.fromEntries(keys.map((key,i)=>[key,!!(bits&(1<<i))]));
 assert.equal(canRevealStartup(state),bits===31,'startup must not reveal a wrong session, locale or route');
}
const {createSubmissionLock}=load('src/utils/submissionLock.ts');
(async()=>{
 const lock=createSubmissionLock();let calls=0,resolve,reject;
 async function submit(){if(!lock.tryAcquire())return;calls++;try{await new Promise((yes,no)=>{resolve=yes;reject=no;});}finally{lock.release();}}
 const first=submit();await submit();assert.equal(calls,1,'a second tap in the same frame cannot submit');resolve();await first;
 const retry=submit();await submit();assert.equal(calls,2,'success unlocks the next action');reject(new Error('offline'));await assert.rejects(retry,/offline/);
 const afterError=submit();assert.equal(calls,3,'failure also unlocks retry');resolve();await afterError;
 const separate=createSubmissionLock();assert.equal(separate.tryAcquire(),true,'different mounted forms do not share a global lock');separate.release();
 console.log('PASS all 32 launch readiness combinations; duplicate taps, success, failure/retry and independent forms');
})().catch(error=>{console.error(error);process.exitCode=1;});
