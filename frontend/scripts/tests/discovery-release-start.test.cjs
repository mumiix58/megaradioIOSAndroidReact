const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file,mocks={}){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:id=>{if(!(id in mocks))throw Error(id);return mocks[id];}});return module.exports;}
let timing,bridges=0;const React={useCallback:f=>f,useRef:current=>({current}),useState:v=>[v,()=>{}],useEffect:()=>{},useMemo:f=>f()};
const gesture=new Proxy({},{get:()=>()=>gesture});
const cubic=t=>t*t*t;
const easing={cubic,out:fn=>t=>1-fn(1-t),inOut:fn=>t=>t<.5?fn(t*2)/2:1-fn((1-t)*2)/2};
const animation={useSharedValue:value=>({value}),useReducedMotion:()=>false,useAnimatedReaction(){},cancelAnimation(){},useAnimatedStyle:f=>f(),runOnJS:f=>f,runOnUI:f=>(...args)=>{bridges++;return f(...args);},Easing:easing,withTiming:(target,options,finish)=>{timing={target,options,finish};return target;}};
const {useCarCarousel}=load('src/hooks/useCarCarousel.ts',{react:React,'react-native-gesture-handler':{Gesture:{Pan:()=>gesture,Tap:()=>gesture,Race:()=>gesture}},'react-native-reanimated':animation,'../utils/carCarousel':load('src/utils/carCarousel.ts')});
let committed=[];const immediate=useCarCarousel({unit:1,count:20,visible:true,immediateStart:true,onPreview(){},onCommit:i=>committed.push(i)});
immediate.stepUI(-8,1050);assert.equal(bridges,0,'UI release directly starts timing without a JS-to-UI round trip');assert.equal(timing.target,-8);const firstFrame=timing.options.easing(16/1050);assert.ok(firstFrame>.04,'first display frame has visible motion, not ease-in dead travel');timing.finish(true);assert.deepEqual(committed,[12],'signed spin still commits the correct radio');
const car=useCarCarousel({unit:1,count:20,visible:true,onPreview(){},onCommit(){}});car.stepUI(8,1050);assert.ok(timing.options.easing(16/1050)<.001,'existing CarPlay long-spin curve remains unchanged');
console.log('PASS direct UI-thread launch, visible first-frame travel, signed commit and unchanged CarPlay defaults');
