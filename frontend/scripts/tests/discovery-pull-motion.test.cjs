const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(path,mocks={}){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:id=>{if(!(id in mocks))throw Error(id);return mocks[id];}});return module.exports;}
const {discoveryPullMotion}=load('src/utils/discoveryPullMotion.ts');
const idle=discoveryPullMotion(0,1),left=discoveryPullMotion(-14,1),right=discoveryPullMotion(14,1);
assert.equal(idle.scale,1);assert.equal(left.translateX,-right.translateX);assert.equal(left.scale,right.scale);assert.ok(right.scale<=1.02,'round artwork gets only a subtle uniform scale');assert.equal('scaleX' in right,false,'no anisotropic oval deformation');assert.equal('scaleY' in right,false);assert.equal(discoveryPullMotion(99999,1).scale,right.scale,'overpull stays bounded');assert.equal(discoveryPullMotion(7,.5).scale,right.scale,'response is proportional on small devices');
let callbacks={};const chain={};for(const key of ['enabled','maxPointers','activeOffsetX','failOffsetY'])chain[key]=()=>chain;for(const key of ['onBegin','onStart','onUpdate','onEnd','onFinalize'])chain[key]=fn=>{callbacks[key]=fn;return chain;};
const React={memo:f=>f,createElement:()=>null,useCallback:f=>f,useMemo:f=>f(),useEffect:()=>{},useRef:value=>({current:value}),useState:v=>[v,()=>{}]};let reduced=false,timing;
const animation={__esModule:true,default:{View:'Animated'},cancelAnimation(){},runOnJS:f=>f,useSharedValue:value=>({value}),useAnimatedStyle:f=>f(),useAnimatedReaction(){},useReducedMotion:()=>reduced,withSpring:v=>v,withTiming:(v,options,finish)=>{timing={target:v,options,finish};return v;},withSequence:(...v)=>v.at(-1)};
const dial=load('src/components/WorldRadioDial.tsx',{react:React,'react-native':{Text:'Text',View:'View'},'react-native-gesture-handler':{Gesture:{Pan:()=>chain},GestureDetector:'Detector'},'react-native-reanimated':animation,'react-i18next':{useTranslation:()=>({t:(_key,fallback)=>fallback})},'../utils/discoveryPullMotion':load('src/utils/discoveryPullMotion.ts'),'../utils/worldDialMotion':load('src/utils/worldDialMotion.ts'),'../hooks/useTunerTick':{useTunerTick:()=>()=>{}},'./ElasticFrequency':{ElasticFrequency:'Frequency'}}).WorldRadioDial;
function pull(dx,motionScale){let direction;const motion={value:0};dial({unit:1,disabled:false,motion,phase:{value:0},onPrepare(){},onStart(){},onRest(){},onRelease:value=>{direction=value;},...(motionScale===undefined?{}:{motionScale})});callbacks.onBegin();callbacks.onStart();callbacks.onUpdate({translationX:dx});const stretch=motion.value;callbacks.onEnd();return{direction,stretch};}
assert.equal(pull(120,.85).direction,'right');assert.equal(pull(-120,.85).direction,'left');assert.equal(pull(10,.85).direction,undefined,'small gestures do not discover');assert.ok(pull(120,.85).stretch>40);assert.ok(pull(120).stretch<14,'CarPlay keeps the existing default amplitude');reduced=true;assert.equal(pull(120,.85).stretch,0,'reduced motion suppresses deformation while retaining direction');
console.log('PASS signed gesture release, bounded round-artwork resistance, small-device scaling, unchanged CarPlay default and reduced motion');

reduced=false;
for(const [dx,sign] of [[120,-1],[-120,1]]){
 const phase={value:0};let rests=0;
 dial({unit:1,disabled:false,releaseSlots:17,motion:{value:0},phase,onPrepare(){},onStart(){},onRest(){rests++;},onRelease(){}});
 callbacks.onBegin();callbacks.onStart();callbacks.onUpdate({translationX:dx});callbacks.onEnd();
 assert.equal(timing.target,sign*17,'release follows the signed gesture');
 assert.equal(timing.options.duration,1050,'same cadence as chat discovery');
 assert.ok(timing.options.easing(16/1050)>.04,'motion starts on the first frame');
 timing.finish(true);assert.equal(phase.value,0,'whole ring ends without an offset');assert.equal(rests,1);
}
console.log('PASS Car Mode release direction, chat cadence, immediate easing and stable ring landing');
