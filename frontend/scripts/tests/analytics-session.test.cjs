const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports,require,Date,console});return module.exports;}
const {AnalyticsSession,analyticsScreenName}=load('src/services/analyticsSession.ts');
let now=1000;const events=[];const session=new AnalyticsSession((name,params)=>events.push({name,params}),()=>now);
assert.equal(analyticsScreenName(['(tabs)','index']),'home');assert.equal(analyticsScreenName(['messages','[id]']),'messages/detail');
session.route('home');session.route('home');assert.equal(events.length,1);
session.overlay('premium','premium');session.route('player');assert.equal(events.at(-1).params.screen_name,'premium');session.overlay('premium',null);assert.equal(events.at(-1).params.screen_name,'player');
const station={id:'station-a',name:'Radio A',country:'Austria'};
session.playback(station,'loading');assert.equal(events.filter(e=>e.name==='station_play').length,0);
session.playback(station,'error');assert.equal(events.filter(e=>e.name==='station_play').length,0);
session.playback(station,'playing');session.playback(station,'playing');assert.equal(events.filter(e=>e.name==='station_play').length,1);
now+=31000;session.heartbeat();now+=9000;session.playback(station,'paused');now+=60000;session.heartbeat();assert.equal(events.filter(e=>e.name==='listening_time').reduce((n,e)=>n+e.params.duration_seconds,0),40);
session.setActive(false);const count=events.length;session.heartbeat();session.route('messages');assert.equal(events.length,count);session.setActive(true);assert.equal(events.at(-1).params.screen_name,'messages');
session.playback({...station,id:'station-b'},'playing');now+=5000;session.playback(null,'idle');assert.equal(events.filter(e=>e.name==='listening_time').at(-1).params.station_id,'station-b');assert.equal(session.context().station_id,undefined);assert.equal(events.at(-1).name,'station_state_change');assert.equal(events.at(-1).params.playback_state,'idle');assert.equal(events.at(-1).params.station_id,undefined);
const {createAnalyticsClient}=load('src/services/analyticsClient.ts');
(async()=>{const sent=[];let initialized=0;const client=createAnalyticsClient({initialize:async()=>{initialized++;},user:async id=>{sent.push(['user',id]);},property:async()=>{},event:async(n,p)=>{sent.push([n,p]);if(n==='failed')throw Error('offline');}});
await Promise.all([client.setUserId('opaque-id'),client.logScreenView('home'),client.logEvent('failed'),client.setUserId(null),client.logSearch('private@example.com',3)]);
assert.equal(initialized,1);assert.equal(sent[0][1],'opaque-id');assert.equal(sent[3][1],null);assert.equal(sent[4][0],'search');assert.equal(JSON.stringify(sent).includes('private@example.com'),false);
console.log('PASS route/overlay coverage, decoder-only plays, dedupe, listening duration, paused/background exclusion, station switch, logout ordering and no private search text');})().catch(e=>{console.error(e);process.exitCode=1;});
