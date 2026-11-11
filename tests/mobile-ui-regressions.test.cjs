const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../frontend');
const ts = require(root + '/node_modules/typescript');
const tick = () => new Promise(resolve => setImmediate(resolve));

function hooks() {
  const slots = [], effects = [];
  let index = 0;
  const changed = (a, b) => !a || a.length !== b.length || b.some((v, i) => v !== a[i]);
  return {
    createElement(type, props, ...children) { return {type,props:{...props,children}}; },
    begin() { index = 0; },
    flush() { while (effects.length) effects.shift()(); },
    useState(value) {
      const i = index++;
      if (!(i in slots)) slots[i] = value;
      return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }];
    },
    useRef(value) { const i = index++; return slots[i] ||= {current: value}; },
    useMemo(fn, deps) {
      const i = index++;
      if (!slots[i] || changed(slots[i].deps, deps)) slots[i] = {deps, value: fn()};
      return slots[i].value;
    },
    useCallback(fn, deps) {
      const i = index++;
      if (!slots[i] || changed(slots[i].deps, deps)) slots[i] = {deps, value:fn};
      return slots[i].value;
    },
    useEffect(fn, deps) {
      const i = index++;
      if (!slots[i] || changed(slots[i].deps, deps)) {
        const old = slots[i];
        const next = slots[i] = {deps};
        effects.push(() => { old?.cleanup?.(); next.cleanup = fn(); });
      }
    },
  };
}

function load(relative, mocks) {
  const source = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {exports, console:{log(){},error(){}}, require(name) {
    if (name === 'react/jsx-runtime') return {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
    if (name in mocks) return mocks[name];
    throw Error('Missing mock: ' + name);
  }});
  return exports;
}

function find(element, type) {
  if (!element) return null;
  if (Array.isArray(element)) return element.map(x => find(x,type)).find(Boolean);
  if (element.type === type) return element;
  return find(element.props?.children, type);
}

function genresFixture() {
  const runtime = hooks(), calls = [], disk = new Map();
  let country = null, handle = async (page) => ({data:Array.from({length:30},(_,i)=>({_id:`${page}-${i}`,slug:`${page}-${i}`,name:`Genre ${i}`})),total:90});
  const native = Object.fromEntries(['View','Text','TouchableOpacity','TextInput','ActivityIndicator','RefreshControl','FlatList'].map(k=>[k,k]));
  native.StyleSheet = {create:s=>s}; native.useWindowDimensions=()=>({width:400});
  const Component = load('app/(tabs)/genres.tsx', {
    react:runtime, 'react-native':native, 'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},
    'expo-linear-gradient':{LinearGradient:'Gradient'}, '@expo/vector-icons':{Ionicons:'Icon'},
    'expo-router':{useRouter:()=>({push(){}})}, 'react-i18next':{useTranslation:()=>({t:(_key,fallback)=>fallback})},
    '@react-native-async-storage/async-storage':{getItem:async k=>disk.get(k),setItem:async(k,v)=>disk.set(k,v)},
    '../../src/constants/theme':{colors:{},gradients:{},spacing:{},borderRadius:{},typography:{sizes:{},weights:{}}},
    '../../src/store/locationStore':{useLocationStore:()=>({countryCode:country})},
    '../../src/hooks/useResponsive':{useResponsive:()=>({sidePadding:16})},
    '../../src/services/genreService':{genreService:{getGenres:async(...args)=>{calls.push(args);return handle(...args);}}},
  }).default;
  return {calls, setCountry:c=>country=c, network:fn=>handle=fn, render() {runtime.begin();const tree=Component();runtime.flush();return tree;}};
}

test('genres starts at page one, ignores duplicate end events and retries the failed page', async () => {
  const f=genresFixture(); f.render(); await tick();
  let list=find(f.render(),'FlatList'); assert.equal(list.props.data.length,30); assert.equal(f.calls[0][0],1);
  list.props.onEndReached(); list.props.onEndReached(); await tick();
  list=find(f.render(),'FlatList'); assert.equal(list.props.data.length,60); assert.equal(f.calls.length,2);
  f.network(async()=>{throw Error('503');}); list.props.onEndReached(); await tick();
  list=find(f.render(),'FlatList'); assert.equal(list.props.data.length,60);
  list.props.onEndReached(); assert.equal(f.calls.length,3);
  f.network(async()=>({data:[{_id:'last',slug:'last',name:'Last'}],total:61}));
  await list.props.ListFooterComponent().props.onPress();
  list=find(f.render(),'FlatList'); assert.equal(f.calls.at(-1)[0],3); assert.equal(list.props.data.length,61);
});

test('late genres from the previous country cannot replace the current country', async () => {
  const f=genresFixture(); let resolveOld;
  f.network(()=>new Promise(resolve=>resolveOld=resolve)); f.render(); await tick();
  f.network(async()=>({data:[{_id:'tr',slug:'tr',name:'Turkish'}],total:1}));
  f.setCountry('TR'); f.render(); await tick();
  resolveOld({data:[{_id:'old',slug:'old',name:'Old'}],total:1}); await tick();
  assert.equal(find(f.render(),'FlatList').props.data[0]._id,'tr');
  assert.equal(f.calls.at(-1)[2],'TR');
});

test('an API error is retryable and is never represented as no genres', async () => {
  const f=genresFixture(); f.network(async()=>{throw Error('503');}); f.render(); await tick();
  const list=find(f.render(),'FlatList'); assert.equal(list.props.ListEmptyComponent,null);
  assert.ok(list.props.ListFooterComponent().props.onPress);
});

test('a failed refresh retries page one while keeping the last loaded genres visible', async () => {
  const f=genresFixture(); f.render(); await tick();
  let list=find(f.render(),'FlatList');
  f.network(async()=>{throw Error('503');}); await list.props.refreshControl.props.onRefresh();
  list=find(f.render(),'FlatList'); assert.equal(list.props.data.length,30);
  await list.props.ListFooterComponent().props.onPress(); assert.equal(f.calls.at(-1)[0],1);
});

test('slow and broken remote logos display the bundled fallback from the first render', () => {
  const runtime=hooks();
  const Component=load('src/components/ImageWithFallback.tsx',{
    react:runtime,'expo-image':{Image:'Image'},
    '../utils/stationLogoHelper':{DEFAULT_STATION_LOGO_SOURCE:7,DEFAULT_STATION_LOGO_URL:'https://themegaradio.com/logo.png'},
  }).ImageWithFallback;
  const props={uri:'https://www.reyfm.de/icon.png',fallbackUri:'https://another.invalid/logo.png'};
  function render(p=props) {runtime.begin();const result=Component(p);runtime.flush();return result;}
  let image=render(); assert.equal(image.props.placeholder,7); assert.equal(image.props.placeholderContentFit,'contain');
  image.props.onError({}); image=render(); assert.equal(image.props.placeholder,7);
  image.props.onError({}); image=render(); assert.equal(image.props.source,7);
  image=render({uri:null}); assert.equal(image.props.source,7);
});
