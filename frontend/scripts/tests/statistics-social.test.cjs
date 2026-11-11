const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
const counts={exports:{}};vm.runInNewContext(compile('src/utils/publicProfileView.ts'),{module:counts,exports:counts.exports});
function render(owner='owner-a',profile={followersCount:12,followingCount:7}){
 const routes=[];let state=0;const initial=[owner,{totalMinutes:0,uniqueStations:0,musicPlayed:0},false];
 const React={createElement:(type,props,...children)=>({type,props:{...props,children}}),useState:()=>[initial[state++],()=>{}],useCallback:f=>f};
 const mocks={react:React,'react-native':{...Object.fromEntries(['View','Text','ScrollView','TouchableOpacity'].map(x=>[x,x])),StyleSheet:{create:x=>x},useWindowDimensions:()=>({width:375})},'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},'expo-image':{Image:'Image'},'expo-router':{useRouter:()=>({push:r=>routes.push(r),dismissTo:r=>routes.push({dismissTo:r})}),useFocusEffect:()=>{}},'react-i18next':{useTranslation:()=>({t:(_,fallback)=>fallback})},'../src/store/authStore':{useAuthStore:selector=>selector({isAuthenticated:!!owner,user:{_id:owner}})},'../src/hooks/useQueries':{useUserProfile:id=>{assert.equal(id,owner||'');return {data:profile}}},'../src/utils/publicProfileView':counts.exports,'../src/services/statsService':{},'../src/components/MegaLoadingState':{MegaLoadingState:'Loading'}};
 const module={exports:{}};vm.runInNewContext(compile('app/statistics.tsx'),{module,exports:module.exports,require:id=>id.endsWith('.svg')?id:mocks[id]});
 return {tree:module.exports.default(),routes};
}
function find(node,id){if(!node||typeof node!=='object')return null;if(node.props?.testID===id)return node;for(const child of (node.props?.children||[]).flat(Infinity)){const found=find(child,id);if(found)return found;}return null;}
const view=render();find(view.tree,'statistics-back-btn').props.onPress();assert.equal(view.routes.pop().dismissTo,'/(tabs)/profile');for(const direction of ['followers','following']){const card=find(view.tree,'statistics-'+direction);assert.ok(card);card.props.onPress();assert.equal(view.routes.at(-1).pathname,'/(tabs)/profile');assert.equal(view.routes.at(-1).params.connections,direction);assert.equal(view.routes.at(-1).params.connectionsFrom,'statistics');}
assert.equal(find(view.tree,'statistics-followers').props.accessibilityLabel,'Followers: 12');
assert.equal(find(render('owner-b',{followersCount:2,followingCount:4}).tree,'statistics-followers').props.accessibilityLabel,'Followers: 2');
assert.equal(find(render('owner-b',{}).tree,'statistics-following').props.accessibilityLabel,'Follows: —');
assert.equal(find(render(null).tree,'statistics-followers'),null);
console.log('PASS statistics real profile counts, unavailable state, guest isolation and both connection routes');
