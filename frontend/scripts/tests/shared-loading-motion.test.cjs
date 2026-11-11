const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const cleanups=[],loops=[],listeners={};let reductions=0;
class Value{constructor(value){this.value=value;}setValue(value){this.value=value;}}
const rn={Platform:{OS:'web'},Easing:{linear:x=>x},AppState:{currentState:'active',addEventListener:(_,callback)=>{listeners.app=callback;return{remove(){delete listeners.app;}};}},AccessibilityInfo:{isReduceMotionEnabled:async()=>false,addEventListener:(_,callback)=>{reductions++;listeners.motion=callback;return{remove(){delete listeners.motion;}};}},Animated:{Value,timing:(value,options)=>({value,options}),loop:timing=>{const loop={timing,starts:0,stops:0,start(){this.starts++;},stop(){this.stops++;}};loops.push(loop);return loop;}}};
const react={useRef:value=>({current:value}),useEffect:effect=>cleanups.push(effect())};const mod={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/hooks/useSharedLoadingMotion.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:mod,exports:mod.exports,require:name=>name==='react'?react:rn});
const use=mod.exports.useSharedLoadingMotion;
const shapes=Array.from({length:40},()=>use('shimmer'));assert.ok(shapes.every(value=>value===shapes[0]));assert.equal(loops.length,1);assert.equal(reductions,1);
const ring=use('ring');use('ring');assert.equal(loops.length,2);assert.equal(reductions,1,'all loaders share accessibility/background listeners');
assert.equal(loops[0].timing.options.isInteraction,false,'loading never blocks navigation');
listeners.app('background');assert.equal(loops[0].stops,1);assert.equal(loops[1].stops,1);
listeners.app('active');assert.equal(loops.length,4);listeners.motion(true);assert.equal(loops[2].stops,1);assert.equal(loops[3].stops,1);
assert.equal(ring.value,0);assert.equal(shapes[0].value,0);
Promise.resolve().then(()=>{
 assert.equal(loops.length,4,'a late initial preference read must not undo a newer reduced-motion event');
 cleanups.forEach(cleanup=>cleanup());assert.equal(listeners.app,undefined);assert.equal(listeners.motion,undefined);
 console.log('PASS 40 shapes + rings use two clocks/one listener pair; background, reduced-motion race, nonblocking animation and final cleanup');
}).catch(error=>{console.error(error);process.exitCode=1;});
