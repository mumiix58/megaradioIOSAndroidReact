const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../frontend/tvanddesktop/apple-tv-and-macos/web-preview/public/js/tv-audio-player.js'), 'utf8');
function fixture() {
  const pending=[], listeners=[], timers=new Map(); let sequence=0,state='NONE',plays=0,errors=0,started=0;
  const api={getState:()=>state,stop(){state='IDLE'},close(){state='NONE'},open(){state='IDLE'},setListener(l){listeners.push(l)},prepareAsync(ok,fail){pending.push({ok(){state='READY';ok()},fail})},play(){plays++;state='PLAYING'},pause(){state='PAUSED'}};
  const c={platform:'samsung',console:{log(){},error(){}},webapis:{avplay:api},setTimeout(fn){timers.set(++sequence,fn);return sequence},clearTimeout(id){timers.delete(id)}}; c.window=c;
  vm.runInNewContext(source,c); const player=new c.TVAudioPlayer('qa'); player.onPlay=()=>started++;player.onError=()=>errors++;
  return {player,pending,listeners,timers,api, counts:()=>({plays,errors,started}),state:()=>state};
}
test('old prepare success/error and listener cannot affect a newer station',()=>{
  const f=fixture(); f.player.play('station-a'); const oldTimer=[...f.timers.values()][0];f.player.play('station-b');
  f.pending[0].ok();f.pending[0].fail('late');f.listeners[0].onerror('late');oldTimer();
  assert.deepEqual(f.counts(),{plays:0,errors:0,started:0}); assert.equal(f.timers.size,1);
  f.pending[1].ok();assert.deepEqual(f.counts(),{plays:1,errors:0,started:1});
});
test('listener plus prepare error is one failed attempt and cannot later succeed',()=>{
  const f=fixture();f.player.play('dead');f.listeners[0].onerror('network');f.pending[0].fail('prepare');f.pending[0].ok();
  assert.deepEqual(f.counts(),{plays:0,errors:1,started:0});assert.equal(f.timers.size,0);
  f.player.play('retry');f.pending[1].ok();assert.equal(f.counts().plays,1);
});
test('stop invalidates queued native callbacks and watchdog',()=>{
  const f=fixture();f.player.play('a');const timer=[...f.timers.values()][0];f.player.stop();f.pending[0].ok();f.listeners[0].onerror('late');timer();
  assert.deepEqual(f.counts(),{plays:0,errors:0,started:0});assert.equal(f.timers.size,0);
});
test('pending pause never autoplays; prepared playback still pauses and resumes normally',()=>{
  const f=fixture();f.player.play('a');f.player.pause();f.pending[0].ok();assert.equal(f.counts().plays,0);assert.equal(f.timers.size,0);
  f.player.play('b');f.pending[1].ok();f.player.pause();assert.equal(f.state(),'PAUSED');f.player.resume();assert.equal(f.state(),'PLAYING');assert.equal(f.counts().plays,2);
});
test('current watchdog reports one timeout; late native callbacks cannot resurrect it',()=>{
  const f=fixture();f.player.play('slow');const watchdog=[...f.timers.values()][0];watchdog();f.pending[0].ok();f.pending[0].fail('late');f.listeners[0].onerror('late');
  assert.deepEqual(f.counts(),{plays:0,errors:1,started:0});
  f.player.play('working');f.pending[1].ok();f.listeners[1].onerror('network');f.pending[1].fail('duplicate');
  assert.deepEqual(f.counts(),{plays:1,errors:2,started:1});
});
test('explicit resume restarts paused preparation and rejects its old callback before or after native READY',()=>{
  for(const readyBeforeResume of [true,false]) {
    const f=fixture();f.player.play('pending');f.player.pause();
    if(readyBeforeResume) f.pending[0].ok();
    f.player.resume();assert.equal(f.pending.length,2,'resume starts a fresh prepare attempt');
    f.pending[0].ok();assert.equal(f.counts().plays,0,'old prepare cannot play');
    f.pending[1].ok();assert.equal(f.state(),'PLAYING');assert.equal(f.counts().plays,1);
  }
});
