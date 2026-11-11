const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file,mocks){const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,{module:mod,exports:mod.exports,require:n=>{if(n in mocks)return mocks[n];throw Error(n);},Intl,Number,Error,console,__DEV__:false});return mod.exports;}
const {formatVoteCount}=load('src/utils/voteCount.ts',{});
assert.equal(formatVoteCount(823554,'tr'),'823,6K');assert.equal(formatVoteCount(20400,'en'),'20.4K');assert.equal(formatVoteCount(999,'tr'),'999');assert.equal(formatVoteCount(999999,'tr'),'1M');
const {trackSearchUrls}=load('src/utils/nowPlaying.ts',{});
assert.equal(trackSearchUrls('Björk & Radio').deezer.web,'https://www.deezer.com/search/Bj%C3%B6rk%20%26%20Radio');assert.match(trackSearchUrls('Track').soundcloud.web,/soundcloud/);
let state=[],cursor=0,owner='account-a',cache,requests=0,deferred,fail=false,notices=[],totals=[],animations=0;
const React={createElement:(type,props,...children)=>({type,props:{...props,children}}),useState:init=>{const i=cursor++;state[i]??=typeof init==='function'?init():init;return[state[i],v=>{state[i]=v;}];},useRef:init=>{const i=cursor++;return state[i]??=( {current:init});},useEffect:()=>{cursor++;}};
class Value{setValue(){}stopAnimation(){}interpolate(){return 1;}}
const animation=()=>({start(){animations++;},stop(){}});
const Native={TouchableOpacity:'Touch',Text:'Text',ActivityIndicator:'Loading',AccessibilityInfo:{},StyleSheet:{create:x=>x,absoluteFill:{}},Animated:{Value,View:'Animated',parallel:animation,sequence:animation,timing:animation,delay:animation},Easing:{bezier(){},out(){},cubic(){},quad(){}}};
const client={setQueryData:(_key,data)=>{cache=data;}};
const {StationVoteButton}=load('src/components/StationVoteButton.tsx',{'./MegaLoadingIndicator':{MegaLoadingIndicator:'Spinner'},react:React,'react-native':Native,'react-native-svg':{default:'Svg'},'@tanstack/react-query':{useQuery:()=>({data:cache}),useQueryClient:()=>client},'react-i18next':{useTranslation:()=>({t:k=>k,i18n:{language:'tr'}})},'../utils/voteCount':{formatVoteCount},'../store/authStore':{useAuthStore:fn=>fn({isAuthenticated:!!owner,user:owner?{_id:owner}:null})},'../services/stationService':{stationService:{voteStation:async()=>{requests++;if(deferred)await deferred;if(fail)throw Error('offline');return{success:true,votes:823555,hasVoted:true,alreadyVoted:false};}}}});
const props={stationId:'station',countLabel:'823,6K',fullCount:823554,onNotice:n=>notices.push(n),onVoted:n=>totals.push(n)};
function render(extra={}){cursor=0;return StationVoteButton({...props,...extra}).props;}
(async()=>{
 let release;deferred=new Promise(r=>release=r);let button=render();const first=button.onPress();await button.onPress();assert.equal(requests,1);release();await first;deferred=null;assert.equal(totals[0],823555);assert.equal(animations,1);
 button=render();await button.onPress();assert.equal(requests,1);assert.equal(notices.at(-1).message,'vote_already_cast');
 owner=null;cache=null;await render().onPress();assert.equal(requests,1);assert.equal(notices.at(-1).message,'vote_login_required');
 owner='account-b';fail=true;await render().onPress();assert.equal(totals.length,1);assert.equal(notices.at(-1).error,true);fail=false;
 await render({preview:true}).onPress();assert.equal(requests,2);assert.equal(notices.at(-1).message,'vote_preview');
 let finish;deferred=new Promise(r=>finish=r);const pending=render().onPress();owner='account-c';render();finish();await pending;assert.equal(totals.length,1,'previous account response cannot apply to next account');
 console.log('PASS K/M boundaries, Deezer + SoundCloud links, actual vote handler double-tap lock, duplicate, auth, failure, preview isolation and account-switch guard');
})().catch(e=>{console.error(e);process.exitCode=1;});
