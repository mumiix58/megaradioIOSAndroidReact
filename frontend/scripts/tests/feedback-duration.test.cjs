const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
const source=ts.transpileModule(fs.readFileSync('src/components/ProfilePhotoFeedback.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
async function duration(error,override,os='web',recommended=0){
 const timers=[],effects=[];let cleared=false;
 const react={createElement:()=>null,useRef:x=>({current:x}),useEffect:fn=>effects.push(fn)};
 const rn={Text:()=>null,StyleSheet:{create:x=>x},Platform:{OS:os},AccessibilityInfo:{announceForAccessibility:()=>{},getRecommendedTimeoutMillis:async()=>recommended},Animated:{Value:class{setValue(){} interpolate(){} stopAnimation(){}},View:()=>null,timing:()=>({start:()=>{},stop:()=>{}})}};
 const m={exports:{}};vm.runInNewContext(source,{module:m,exports:m.exports,require:n=>n==='react'?react:rn,setTimeout:(fn,ms)=>{timers.push(ms);return 1},clearTimeout:()=>{cleared=true},Math});
 m.exports.ProfilePhotoFeedback({notice:{error,message:'Message'},onDismiss:()=>{},durationMs:override});const cleanup=effects[0]();await new Promise(setImmediate);assert.equal(timers.length,1);cleanup();assert.ok(cleared);return timers[0];
}
(async()=>{assert.equal(await duration(true),9000);assert.equal(await duration(false),7000);assert.equal(await duration(true,3500),3500);assert.equal(await duration(true,3500,'android',6000),6000);console.log('PASS location-only 3.5s override, unchanged success/error defaults, Android accessibility timeout and cleanup');})().catch(e=>{console.error(e);process.exitCode=1});
