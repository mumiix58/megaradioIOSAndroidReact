const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
const source=ts.transpileModule(fs.readFileSync('src/components/chat/ChatVoice.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
function setup({granted=true,recording=false}={}){
 const effects=[],calls=[],done=[];const recorder={uri:'file:///fixture.m4a',prepareToRecordAsync:async()=>calls.push('prepare'),record:()=>calls.push('record'),stop:async()=>calls.push('stop')};
 const react={createElement:(type,props,...children)=>({type,props:{...props,children}}),useRef:current=>({current}),useState:initial=>[initial,()=>{}],useEffect:f=>effects.push(f)};
 const audio={RecordingPresets:{HIGH_QUALITY:{}},useAudioRecorder:()=>recorder,useAudioRecorderState:()=>({durationMillis:1200,isRecording:recording}),requestRecordingPermissionsAsync:async()=>({granted}),setAudioModeAsync:async mode=>calls.push(mode.allowsRecording?'record-mode':'play-mode')};
 const mod={exports:{}};vm.runInNewContext(source,{module:mod,exports:mod.exports,require:id=>id==='react'?react:id==='react-native'?{View:'View',Text:'Text',TouchableOpacity:'Button',StyleSheet:{create:x=>x},AppState:{addEventListener:()=>({remove(){}})}}:id==='expo-audio'?audio:id==='react-i18next'?{useTranslation:()=>({t:key=>key})}:id.includes('useAudioPlayer')?{useAudioPlayer:()=>({pause:()=>calls.push('pause-radio')})}:{ChatIcon:'Icon'}});
 const tree=mod.exports.VoiceRecorderPanel({onDone:x=>done.push(x),onCancel(){}});const cleanups=effects.map(f=>f());
 const find=node=>{if(!node||typeof node!=='object')return;if(node.props?.testID==='chat-record-start')return node;return node.props?.children?.flat(Infinity).map(find).find(Boolean)};
 return {calls,done,press:()=>find(tree).props.onPress(),dispose:()=>cleanups.forEach(f=>f?.())};
}
(async()=>{
 const allowed=setup();await allowed.press();assert.equal(allowed.calls.join(','),'pause-radio,record-mode,prepare,record');allowed.dispose();await new Promise(r=>setImmediate(r));assert.ok(allowed.calls.includes('stop'));assert.equal(allowed.calls.at(-1),'play-mode');
 const denied=setup({granted:false});await denied.press();assert.equal(denied.calls.length,0);denied.dispose();
 const review=setup({recording:true});await review.press();assert.equal(review.done[0].uri,'file:///fixture.m4a');assert.equal(review.done[0].duration,1.2);assert.equal(review.done[0].mimeType,'audio/mp4');review.dispose();
 console.log('PASS voice permission denial, radio pause before recording, recorder cleanup and review draft (microphone mocked)');
})().catch(e=>{console.error(e);process.exitCode=1});
