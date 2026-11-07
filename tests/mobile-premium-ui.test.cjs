const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('../frontend/node_modules/typescript');
const source = ts.transpileModule(fs.readFileSync(require.resolve('../frontend/src/components/PremiumPaywall.tsx'),'utf8'), {
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},
}).outputText;
function render(entitlement,mode='premium') {
  const exports={};
  const component=(type,props)=>({type,props});
  const mocks={
    react:{useState:v=>[v,()=>{}],useRef:v=>({current:v}),useEffect(){},useCallback:fn=>fn},
    'react/jsx-runtime':{jsx:component,jsxs:component},
    'react-native':{View:'View',Text:'Text',TouchableOpacity:'Button',Modal:'Modal',ScrollView:'ScrollView',ActivityIndicator:'Spinner',
      Dimensions:{get:()=>({width:375})},StyleSheet:{create:x=>x},Platform:{OS:'ios'}},
    'expo-linear-gradient':{LinearGradient:'Gradient'},'@expo/vector-icons':{Ionicons:'Icon'},
    'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:0,bottom:0})},
    'expo-router':{useRouter:()=>({push(){}})},'react-i18next':{useTranslation:()=>({t:(_key,fallback)=>fallback})},
    '../services/analyticsService':{analyticsService:{logDiagnosticEvent:async()=>{}}},
    '../store/premiumStore':{usePremiumStore:()=>entitlement},'../store/authStore':{useAuthStore:{}},
  };
  vm.runInNewContext(source,{exports,console,setTimeout,require:n=>{if(!(n in mocks))throw Error(n);return mocks[n];}});
  return JSON.stringify(exports.PremiumPaywall({visible:true,mode,onClose(){}}));
}
test('yearly Premium presents active status and management instead of another checkout',()=>{
  for(const mode of ['premium','remove_ads']) {
    const tree=render({isPremium:true,isRemoveAds:true,plan:'premium_yearly'},mode);
    assert.match(tree,/Premium Active/);assert.match(tree,/premium-manage-subscription/);
    assert.doesNotMatch(tree,/premium-subscribe-btn|remove-ads-subscribe-btn|premium-yearly-option/);
  }
});
test('ad-free subscriber sees active status for ads and may still upgrade to Premium',()=>{
  const state={isPremium:false,isRemoveAds:true,plan:'remove_ads'};
  assert.match(render(state,'remove_ads'),/Ad-free Active/);
  assert.doesNotMatch(render(state,'remove_ads'),/remove-ads-subscribe-btn/);
  assert.match(render(state,'premium'),/premium-subscribe-btn/);
});
test('lifetime membership does not offer recurring subscription management',()=>{
  const tree=render({isPremium:true,isRemoveAds:true,plan:'premium_lifetime'});
  assert.match(tree,/Premium Active/);assert.doesNotMatch(tree,/premium-manage-subscription|premium-subscribe-btn/);
});

test('both offers disclose broadcaster ads and offer retry without invented prices',()=>{
  const state={isPremium:false,isRemoveAds:false,plan:'none'};
  for(const mode of ['premium','remove_ads']) {
    const tree=render(state,mode);
    assert.match(tree,/Advertisements within radio broadcasts/);
    assert.match(tree,/Prices could not be loaded/);
    assert.doesNotMatch(tree,/5\.99|remove all annoying ads/);
  }
});
