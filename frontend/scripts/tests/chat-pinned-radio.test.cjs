const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const transpile=path=>ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const gift={stationId:'station',name:'Jazz',intent:'together'},station={_id:'station',name:'Jazz',url:'https://stream.test/live'};
function harness({playing=false,missing=false,wait=false}={}){
 const state={currentStation:playing?station:null,playbackState:playing?'playing':'paused'},calls=[],refs=[];let index=0,active=null,resolve;
 const React={useRef:v=>refs[index++]||(refs[index-1]={current:v}),useEffect:f=>f(),useState:v=>[v,next=>calls.push(['state',next])]};
 const usePlayerStore=Object.assign(fn=>fn(state),{getState:()=>state});
 const mod={exports:{}};
 vm.runInNewContext(transpile('src/hooks/useChatRadioPlayback.ts'),{exports:mod.exports,module:mod,require:id=>id==='react'?React:id==='./useAudioPlayer'?{useAudioPlayer:()=>({pause(){calls.push(['pause']);state.playbackState='paused';},async playStation(s){calls.push(['play',s]);state.currentStation=s;state.playbackState='playing';}})}:id==='../store/playerStore'?{usePlayerStore}:id==='../store/chatListeningStore'?{useChatListeningStore:{getState:()=>({setActive:value=>{active=value;}})}}:{stationService:{getStation:()=>{calls.push(['get']);return wait?new Promise(r=>resolve=r):Promise.resolve(missing?null:station);}}}});
 return {calls,state,get active(){return active;},finish:()=>resolve?.(station),render:input=>{index=0;return mod.exports.useChatRadioPlayback({gift,messageId:'pin',owner:'me',partnerId:'peer',preview:true,...input});}};
}
(async()=>{
 const self=harness();const pin=self.render({groupId:'group'});await pin.play();assert.equal(self.active.messageId,'pin');assert.equal(self.active.groupId,'group');assert.equal(self.calls.filter(c=>c[0]==='play').length,1);await pin.play();assert.equal(self.calls.filter(c=>c[0]==='pause').length,1,'pin pauses the same shared engine');
 const playing=harness({playing:true});await playing.render().play();assert.equal(playing.calls.filter(c=>c[0]==='get').length,0,'pause must not wait for a station request');
 const failure=harness({missing:true});await failure.render().play();assert.equal(failure.active,null);assert.equal(failure.calls.filter(c=>c[0]==='play').length,0);
 const stale=harness({wait:true});const pending=stale.render().play();stale.render({owner:'other'});stale.finish();await pending;assert.equal(stale.active,null);assert.equal(stale.calls.filter(c=>c[0]==='play').length,0,'account/thread change cancels a pending pinned start');
 const mod={exports:{}};vm.runInNewContext(transpile('src/components/chat/ChatPinnedRadioBanner.tsx'),{exports:mod.exports,module:mod,require:()=>({})});const current=mod.exports.currentRadioListeners;
 const entry=(id,s='station',at=200)=>({user:{_id:id},stationId:s,expiresAt:at});
 assert.equal(JSON.stringify(current([entry('peer'),entry('peer'),entry('me'),entry('other','other'),entry('expired','station',99)],'station','me',100)),JSON.stringify([{_id:'peer'}]));
 assert.equal(current([entry('peer')],'station','me',201).length,0,'expired listeners disappear without inventing a listener');
 console.log('PASS pinned/card shared playback, immediate pause, presence context, failed/stale requests, station matching, expiry and listener deduplication');
})().catch(error=>{console.error(error);process.exitCode=1;});
