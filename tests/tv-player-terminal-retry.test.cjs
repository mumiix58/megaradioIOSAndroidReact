const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.resolve(__dirname,'../frontend/tvanddesktop/apple-tv-and-macos/web-preview');const ts=require(path.join(base,'node_modules/typescript'));
const source=fs.readFileSync(path.join(base,'src/contexts/GlobalPlayerContext.tsx'),'utf8');const ast=ts.createSourceFile('GlobalPlayer.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const arrows={};
function visit(n){if(ts.isBinaryExpression(n)&&ts.isArrowFunction(n.right)&&['playerInstance.onError','playerInstance.onPlay'].includes(n.left.getText(ast)))arrows[n.left.getText(ast).split('.')[1]]=n.right;if(ts.isVariableDeclaration(n)&&['playStation','retryCurrentStation'].includes(n.name.getText(ast)))arrows[n.name.getText(ast)]=n.initializer;ts.forEachChild(n,visit)}visit(ast);
function harness(){
 const timers=new Map(),plays=[],events=[];let id=0;const station={_id:'unavailable',name:'Unavailable',url:'http://example.invalid/live'};
 const state={playing:false,buffering:false,error:null};const ctx={currentStation:station,currentStationRef:{current:station},retryExhaustedRef:{current:false},manuallyPausedRef:{current:false},retryCountRef:{current:0},retryTimeoutRef:{current:null},playGenerationRef:{current:0},lastStartedStationIdRef:{current:'unavailable'},maxRetries:3,telemetryPlaying:false,token:null,isBrowserAutoplayBlock:()=>false,reportTvEvent:(event)=>events.push(event),console:{log(){},error(){},warn(){}},setIsBuffering:v=>state.buffering=v,setIsPlaying:v=>state.playing=v,setStreamError:v=>state.error=v,setCurrentStation:v=>ctx.currentStation=v,clearTimeout:n=>timers.delete(n),setTimeout:(fn,delay)=>{timers.set(++id,{fn,delay});return id},audioPlayerRef:{current:{play:url=>plays.push(url),stop(){}}},detectPlatform:()=> 'tizen',getProxiedUrl:u=>u,trackStationPlay(){},localStorage:{setItem(){}},recentlyPlayedService:{addStation(){}},recommendationService:{trackListen(){}},trackError(){}};
 vm.runInNewContext(Object.entries(arrows).map(([key,value])=>ts.transpileModule('var '+key+'='+value.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText).join('\n'),ctx);
 function run(delay){const entry=[...timers.entries()].find(([,v])=>v.delay===delay);assert.ok(entry,'expected timer '+delay);timers.delete(entry[0]);entry[1].fn();return entry[1].fn}
 function exhaust(){for(const delay of [1000,2000,4000]){ctx.onError('CONNECTION_FAILED');run(delay);assert.equal(ctx.retryTimeoutRef.current,null)}ctx.onError('CONNECTION_FAILED')}
 return {ctx,state,timers,plays,events,run,exhaust,station};
}
test('actual provider exhausts once and ignores duplicate native listener/prepare errors after terminal failure',()=>{
 const h=harness();h.exhaust();assert.equal(h.plays.length,3);assert.equal(h.ctx.retryCountRef.current,3);assert.equal(h.ctx.retryExhaustedRef.current,true);assert.equal(h.state.error,'This station is currently unavailable');assert.equal(h.timers.size,0);const diagnostics=h.events.length;
 for(let i=0;i<20;i++)h.ctx.onError(i%2?'PREPARE_TIMEOUT':'CONNECTION_FAILED');assert.equal(h.timers.size,0);assert.equal(h.plays.length,3);assert.equal(h.events.length,diagnostics);
});
test('actual duplicate errors preserve the first pending retry deadline and emit one diagnostic',()=>{
 const h=harness();h.ctx.onError('CONNECTION_FAILED');const first=h.ctx.retryTimeoutRef.current;const firstTimer=h.timers.get(first);h.ctx.onError('CONNECTION_FAILED');h.ctx.onError('PREPARE_TIMEOUT');assert.equal(h.ctx.retryTimeoutRef.current,first);assert.equal(h.timers.size,1);assert.equal(h.timers.get(first),firstTimer);assert.equal(h.events.filter(x=>x==='playback_error').length,1);h.run(1000);assert.equal(h.plays.length,1);assert.equal(h.ctx.retryTimeoutRef.current,null);
});
test('actual transient recovery clears failure state and restores the budget for a later independent interruption',()=>{
 const h=harness();h.ctx.onError('CONNECTION_FAILED');h.run(1000);h.ctx.onPlay();assert.equal(h.ctx.retryCountRef.current,0);assert.equal(h.ctx.retryExhaustedRef.current,false);assert.equal(h.state.error,null);assert.equal(h.state.playing,true);h.ctx.onError('CONNECTION_FAILED');h.run(1000);assert.equal(h.plays.length,2);
});
test('actual explicit retry and new station selection reset terminal latch; a stale station retry cannot affect the new selection',()=>{
 const h=harness();h.exhaust();h.ctx.retryCurrentStation();assert.equal(h.ctx.retryExhaustedRef.current,false);assert.equal(h.ctx.retryCountRef.current,0);assert.equal(h.state.error,null);h.run(50);assert.equal(h.plays.length,4);
 h.ctx.onError('CONNECTION_FAILED');const old=[...h.timers.values()][0].fn;const next={_id:'healthy',name:'Healthy',url:'https://example.invalid/healthy'};h.ctx.playStation(next);old();assert.equal(h.ctx.currentStationRef.current,next);assert.equal(h.ctx.retryCountRef.current,0);assert.equal(h.plays.length,4);h.run(50);assert.equal(h.plays[4],next.url);assert.equal(h.ctx.retryExhaustedRef.current,false);
});
test('actual canceled retry cannot survive explicit replay of the same station object or a manual pause',()=>{
 const h=harness();h.ctx.onError('CONNECTION_FAILED');const old=[...h.timers.values()][0].fn;h.ctx.playStation(h.station);old();assert.equal(h.ctx.retryCountRef.current,0);assert.equal(h.plays.length,0);h.run(50);assert.equal(h.plays.length,1);
 h.ctx.onError('CONNECTION_FAILED');h.ctx.manuallyPausedRef.current=true;h.run(1000);assert.equal(h.ctx.retryTimeoutRef.current,null);assert.equal(h.plays.length,1);const eventCount=h.events.length;h.ctx.onError('CONNECTION_FAILED');assert.equal(h.events.length,eventCount);assert.equal(h.timers.size,0);
});
test('actual successful playback can clear a terminal budget without turning terminal error callbacks into retries',()=>{
 const h=harness();h.exhaust();h.ctx.onPlay();assert.equal(h.ctx.retryExhaustedRef.current,false);assert.equal(h.ctx.retryCountRef.current,0);assert.equal(h.state.playing,true);assert.equal(h.state.error,null);assert.equal(h.timers.size,0);
});
test('actual playback success cancels an owned pending retry and its already queued callback',()=>{
 const h=harness();h.ctx.onError('CONNECTION_FAILED');const pending=h.ctx.retryTimeoutRef.current;const queued=h.timers.get(pending).fn;h.ctx.onPlay();assert.equal(h.timers.size,0);assert.equal(h.ctx.retryTimeoutRef.current,null);assert.equal(h.state.playing,true);queued();assert.equal(h.plays.length,0);assert.equal(h.ctx.retryCountRef.current,0);
});
