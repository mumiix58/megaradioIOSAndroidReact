const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
const source=ts.transpileModule(fs.readFileSync('src/hooks/useChatSocket.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function harness(ticket){
 const effects=[],sockets=[],intervals=new Set();let appState;
 class Socket { constructor(url){this.url=url;this.readyState=1;this.sent=[];sockets.push(this);} send(value){this.sent.push(JSON.parse(value));} close(){this.closed=true;this.onclose?.();} }
 const react={useCallback:f=>f,useState:initial=>[initial,()=>{}],useRef:v=>({current:v}),useEffect:f=>effects.push(f)};
 const mod={exports:{}};vm.runInNewContext(source,{module:mod,exports:mod.exports,require:id=>id==='react'?react:id==='react-native'?{AppState:{currentState:'active',addEventListener:(_event,callback)=>{appState=callback;return {remove(){appState=undefined}}}}}:{chatService:{ticket}},WebSocket:Socket,setTimeout,clearTimeout,setInterval:f=>{const x={f};intervals.add(x);return x},clearInterval:x=>intervals.delete(x)});
 return {start(){mod.exports.useChatSocket(true,'friend','owner',()=>{});const cleanup=effects.map(f=>f());return ()=>cleanup.reverse().forEach(f=>f?.());},sockets,intervals,background(){appState('background')}};
}
(async()=>{
 const h=harness(async()=> 'single-use-ticket');const stop=h.start();await flush();assert.equal(h.sockets.length,1);const ws=h.sockets[0];assert.ok(ws.url.endsWith('?ticket=single-use-ticket'));ws.onopen();assert.equal(ws.sent[0].type,'chat:active');assert.equal(ws.sent[0].withUserId,'friend');assert.equal(h.intervals.size,1);h.background();assert.equal(ws.closed,true);assert.equal(h.intervals.size,0);stop();
 let resolveTicket;const late=harness(()=>new Promise(resolve=>resolveTicket=resolve));const dispose=late.start();dispose();resolveTicket('expired-owner-ticket');await flush();assert.equal(late.sockets.length,0);
 const denied=harness(async()=>{throw {response:{status:401}}});const denyStop=denied.start();await flush();assert.equal(denied.sockets.length,0);denyStop();
 console.log('PASS socket ticket handshake, background/heartbeat cleanup, stale-owner ticket cancellation and denied authentication (no network)');
})().catch(e=>{console.error(e);process.exitCode=1});
