const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
let cursor=0,slots=[],currentStation={_id:'a'.repeat(24)};
const React={useState:value=>{let i=cursor++;if(!(i in slots))slots[i]=value;return[slots[i],next=>slots[i]=typeof next==='function'?next(slots[i]):next];},useRef:value=>{let i=cursor++;return slots[i]||(slots[i]={current:value});},useMemo:fn=>fn()};
function load(path,mocks){let module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:id=>mocks[id]});return module.exports;}
const radio=load('src/utils/chatRadio.ts',{'./stationLogoHelper':{getStationLogoUrl:s=>s.favicon||null}}),hook=load('src/hooks/useChatInlinePlayerVisibility.ts',{react:React,'../store/playerStore':{usePlayerStore:selector=>selector({currentStation})},'../utils/chatRadio':radio});
let key='owner:group',message={_id:'one',fromUserId:'owner',toUserId:'',read:true,createdAt:'',content:JSON.stringify({version:1,intent:'together',stationId:currentStation._id,name:'Test'})},messages=[message];
const render=()=>{cursor=0;return hook.useChatInlinePlayerVisibility(key,messages);};
let ui=render();ui.viewabilityProps.onViewableItemsChanged({viewableItems:[{isViewable:true,item:message}]});ui=render();assert.equal(ui.inlineRadioVisible,true,'visible card controls suppress floating player immediately');
ui.viewabilityProps.onViewableItemsChanged({viewableItems:[]});ui=render();assert.equal(ui.inlineRadioVisible,false,'leaving viewport reveals player');
ui.viewabilityProps.onViewableItemsChanged({viewableItems:[{isViewable:true,item:message}]});assert.equal(render().inlineRadioVisible,true,'returning to card suppresses player again');
messages=[{...message,deletedAt:'now'}];assert.equal(render().inlineRadioVisible,false,'deleting a visible radio restores floating controls even without a new viewability event');messages=[];assert.equal(render().inlineRadioVisible,false,'personal hiding cannot strand playback controls');
messages=[message];key='owner:other';assert.equal(render().inlineRadioVisible,false,'visibility does not leak across conversations');key='owner:group';currentStation={_id:'b'.repeat(24)};assert.equal(render().inlineRadioVisible,false,'a different station keeps its player');
console.log('PASS inline controls, viewport exit/re-entry, deletion/hiding, conversation isolation and station switching');
