const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),ts=require(process.cwd()+'/node_modules/typescript');
const compile=p=>ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
const mm={exports:{}};vm.runInNewContext(compile('src/utils/castMedia.ts'),{module:mm,exports:mm.exports,require:()=>({getStationLogoUrl:s=>s.favicon||null})});const {createCastMedia,transferCastMedia}=mm.exports;
const radio=id=>({_id:id,name:id,url:'https://radio.example/'+id});const tick=()=>new Promise(r=>setImmediate(r));const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
function harness({native=true,existing=true,load=async()=>{}}={}){
 let cursor=0,dirty=true,result,slots=[],effects=[],pauses=0,errors=0,subscriptions=0;const loads=[];
 let props={station:radio('a'),streamUrl:radio('a').url,pauseLocal:async()=>{pauses++},onError:()=>errors++};
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const R={useRef:init=>{const id=cursor++;return slots[id]||(slots[id]={current:init})},useState:init=>{const id=cursor++;if(!slots[id])slots[id]={value:init};return [slots[id].value,v=>{v=typeof v==='function'?v(slots[id].value):v;if(!Object.is(v,slots[id].value)){slots[id].value=v;dirty=true}}]},useEffect:(fn,deps)=>{const id=cursor++,old=slots[id];if(!old||!same(old.deps,deps))effects.push(()=>{old?.cleanup?.();slots[id]={deps,cleanup:fn()}})},useCallback:(fn,deps)=>{const id=cursor++;if(!slots[id]||!same(slots[id].deps,deps))slots[id]={fn,deps};return slots[id].fn}};
 const client={loadMedia:async req=>{loads.push(req);return load(req)}};const session={id:'one',client};const listeners={};const manager={getCurrentCastSession:async()=>existing?session:null};for(const name of ['Starting','Started','Resumed','Resuming','Ended','Suspended','StartFailed'])manager['onSession'+name]=fn=>{listeners[name]=fn;subscriptions++;return {remove(){subscriptions--}}};
 const mocks={'react':R,'../services/nativeCasting':{GoogleCast:native?{getSessionManager:()=>manager}:null},'../services/stationService':{__esModule:true,default:{resolveStream:async()=>({candidates:['https://radio.example/resolved']})}},'../utils/castMedia':mm.exports};
 const module={exports:{}};vm.runInNewContext(compile('src/hooks/useCastTransfer.ts'),{module,exports:module.exports,require:id=>{if(!(id in mocks))throw Error(id);return mocks[id]}});
 const flush=async()=>{for(let n=0;n<25;n++){if(dirty){dirty=false;cursor=0;result=module.exports.useCastTransfer(props);const queued=effects;effects=[];queued.forEach(f=>f())}await tick();if(!dirty)return}throw Error('loop')};
 return {flush,loads,listeners,session,update:p=>{props={...props,...p};dirty=true},arm:()=>result.arm(),get result(){return result},get pauses(){return pauses},get errors(){return errors},get subscriptions(){return subscriptions},unmount:()=>slots.forEach(s=>s?.cleanup?.())};
}
(async()=>{
 let count=0;async function test(n,fn){await fn();count++;console.log('PASS '+n)}
 for(const [suffix,codec,mime] of [['.m3u8?x=1','MP3','application/x-mpegURL'],['','AAC+','audio/aac'],['.ogg','','audio/ogg'],['.flac','','audio/flac'],['','','audio/mpeg']])await test('Receiver MIME '+mime,async()=>assert.equal(createCastMedia({...radio('a'),url:'https://r/live'+suffix,codec}).mediaInfo.contentType,mime));
 await test('Invalid stream rejected',async()=>assert.throws(()=>createCastMedia({...radio('a'),url:'invalid'})));
 await test('Load success pauses phone only after acknowledgement',async()=>{const d=deferred();let paused=false;const p=transferCastMedia({loadMedia:()=>d.promise},createCastMedia(radio('a')),()=>{paused=true});assert.equal(paused,false);d.resolve();await p;assert.equal(paused,true)});
 await test('Load failure keeps local audio',async()=>{let paused=false;await assert.rejects(()=>transferCastMedia({loadMedia:async()=>{throw Error('reject')}},createCastMedia(radio('a')),()=>{paused=true}));assert.equal(paused,false)});
 await test('Web preview does not invoke native SDK',async()=>{const h=harness({native:false});await h.flush();h.arm();await h.flush();assert.equal(h.loads.length,0);assert.equal(h.subscriptions,0)});
 await test('Restored session does not autoplay without a user gesture',async()=>{const h=harness();await h.flush();assert.equal(h.loads.length,0);h.arm();await h.flush();assert.equal(h.loads.length,1);assert.equal(h.pauses,1);assert.equal(h.result.remoteStationId,'a')});
 await test('Native picker session starts transfer without an intermediate screen',async()=>{const h=harness({existing:false});await h.flush();h.listeners.Started(h.session);await h.flush();assert.equal(h.loads.length,1)});
 await test('Track metadata and repeated taps do not reload media',async()=>{const h=harness();await h.flush();h.arm();await h.flush();h.update({nowPlaying:{title:'Song'}});h.arm();await h.flush();assert.equal(h.loads.length,1)});
 await test('Changing station transfers to active TV session',async()=>{const h=harness();await h.flush();h.arm();await h.flush();h.update({station:radio('b'),streamUrl:radio('b').url});await h.flush();assert.equal(h.loads.length,2);assert.equal(h.result.remoteStationId,'b')});
 await test('Receiver failure exposes feedback; a new gesture retries',async()=>{let first=true;const h=harness({load:async()=>{if(first){first=false;throw Error('failed')}}});await h.flush();h.arm();await h.flush();assert.equal(h.errors,1);assert.equal(h.pauses,0);h.arm();await h.flush();assert.equal(h.loads.length,2);assert.equal(h.pauses,1)});
 await test('Stale transfer cannot pause a newly selected station',async()=>{const d=deferred(),h=harness({load:()=>d.promise});await h.flush();h.arm();await h.flush();h.update({station:radio('b'),streamUrl:radio('b').url});await h.flush();d.resolve();await h.flush();assert.equal(h.pauses,1);assert.equal(h.result.remoteStationId,'b')});
 await test('Unmount cancels stale callback and removes subscriptions',async()=>{const d=deferred(),h=harness({load:()=>d.promise});await h.flush();h.arm();await h.flush();h.unmount();d.resolve();await tick();assert.equal(h.pauses,0);assert.equal(h.subscriptions,0)});
 await test('Playlist resolves before sending to receiver',async()=>{const h=harness();h.update({station:{...radio('p'),url:'https://r/list.pls'},streamUrl:'https://r/list.pls'});await h.flush();h.arm();await h.flush();assert.equal(h.loads[0].mediaInfo.contentUrl,'https://radio.example/resolved')});
 await test('Session end clears remote state, reconnect works',async()=>{const h=harness();await h.flush();h.arm();await h.flush();h.listeners.Ended();await h.flush();assert.equal(h.result.remoteStationId,null);h.listeners.Started(h.session);await h.flush();assert.equal(h.loads.length,2)});
 await test('Session resumption restores transfer routing',async()=>{const h=harness();await h.flush();h.arm();await h.flush();h.listeners.Suspended();await h.flush();h.listeners.Resumed(h.session);await h.flush();assert.equal(h.result.remoteStationId,'a');assert.equal(h.loads.length,2)});

 function playerHook(remote=true,stopSucceeds=true){
  const calls=[];const local={playStation:async()=>calls.push('local-play'),pause:()=>calls.push('local-pause'),resume:()=>calls.push('local-resume'),togglePlayPause:()=>calls.push('local-toggle'),stopPlayback:async()=>calls.push('local-stop')};
  const state={currentStation:radio('a'),setPlaybackOrigin(){},reset(){}};const store=()=>state;store.getState=()=>state;
  const cast={remoteStationId:remote?'a':null,pause:async()=>calls.push('remote-pause'),resume:async()=>calls.push('remote-resume'),togglePlayPause:async()=>calls.push('remote-toggle'),stop:async()=>{calls.push('remote-stop');return stopSucceeds}};
  const R={useContext:()=>local,useCallback:f=>f};const mocks={'react':R,'../providers/AudioProvider':{AudioContext:{}},'../store/playerStore':{usePlayerStore:store},'../contexts/NativeCastContext':{useNativeCast:()=>cast},'../store/locationStore':{useLocationStore:{getState:()=>({countryEnglish:'Global'})}},'../utils/countryScope':{isGlobalCountry:()=>true}};
  const module={exports:{}};vm.runInNewContext(compile('src/hooks/useAudioPlayer.ts'),{module,exports:module.exports,require:id=>mocks[id],console});return {hook:module.exports.useAudioPlayer(),calls};
 }
 await test('Remote play/pause and resume target the receiver',async()=>{const h=playerHook();await h.hook.pause();await h.hook.resume();await h.hook.togglePlayPause();assert.deepEqual(h.calls,['remote-pause','remote-resume','remote-toggle'])});
 await test('Tapping the same station controls remote playback',async()=>{const h=playerHook();await h.hook.playStation(radio('a'));assert.deepEqual(h.calls,['remote-toggle'])});
 await test('Choosing a different radio starts locally until transfer is acknowledged',async()=>{const h=playerHook();await h.hook.playStation(radio('b'));assert.deepEqual(h.calls,['local-play'])});
 await test('Stop ends remote session before stopping local playback',async()=>{const h=playerHook();await h.hook.stopPlayback();assert.deepEqual(h.calls,['remote-stop','local-stop'])});
 await test('Failed receiver disconnect does not falsely mark playback stopped',async()=>{const h=playerHook(true,false);await h.hook.stopPlayback();assert.deepEqual(h.calls,['remote-stop'])});
 await test('Ordinary phone playback remains local',async()=>{const h=playerHook(false);await h.hook.pause();await h.hook.resume();await h.hook.togglePlayPause();await h.hook.stopPlayback();assert.deepEqual(h.calls,['local-pause','local-resume','local-toggle','local-stop'])});

 await test('Root Cast provider renders before translations initialize',async()=>{
  const React=require(process.cwd()+'/node_modules/react'),server=require(process.cwd()+'/node_modules/react-dom/server'),i18next=require(process.cwd()+'/node_modules/i18next'),ri=require(process.cwd()+'/node_modules/react-i18next');
  const context=React.createContext({});const instance=i18next.createInstance();
  const mocks={'react':React,'react-native':{StyleSheet:{create:x=>x},Text:'span',View:'div'},'react-native-safe-area-context':{useSafeAreaInsets:()=>({bottom:0})},'react-i18next':ri,'./AudioProvider':{AudioContext:React.createContext(null)},'../contexts/NativeCastContext':{NativeCastContext:context},'../hooks/useCastTransfer':{useCastTransfer:()=>({client:null,remoteStationId:null,connected:false,arm(){}})},'../store/playerStore':{usePlayerStore:()=>({currentStation:null,streamUrl:null,nowPlaying:null})},'../services/nativeCasting':{GoogleCast:null}};
  const module={exports:{}};vm.runInNewContext(compile('src/providers/NativeCastProvider.tsx'),{module,exports:module.exports,require:id=>mocks[id],setTimeout,clearTimeout});
  const html=server.renderToString(React.createElement(React.Suspense,{fallback:React.createElement('span',null,'loading-root')},React.createElement(ri.I18nextProvider,{i18n:instance},React.createElement(module.exports.NativeCastProvider,null,React.createElement('span',null,'app-ready')))));
  assert.ok(html.includes('app-ready'));assert.ok(!html.includes('loading-root'));
 });
 console.log('PASS '+count+' Cast cases');
})().catch(e=>{console.error(e);process.exitCode=1});
