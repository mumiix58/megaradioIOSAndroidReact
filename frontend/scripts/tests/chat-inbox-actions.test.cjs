const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const transpile=p=>ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const stateMod={exports:{}};
vm.runInNewContext(transpile('src/services/chatInboxService.ts'),{exports:stateMod.exports,module:stateMod,require:()=>({default:{}})});
const {applyInboxAction,inboxDeleted}=stateMod.exports;
let states=applyInboxAction([],'peer','archive','2026-11-10T10:00:00Z');
states=applyInboxAction(states,'peer','mute');states=applyInboxAction(states,'peer','unread');
assert.equal(states[0].archived,true);assert.equal(states[0].muted,true);assert.equal(states[0].markedUnread,true);
states=applyInboxAction(states,'peer','delete','2026-11-10T11:00:00Z');
assert.equal(states[0].markedUnread,false);assert.equal(inboxDeleted(states[0],'2026-11-10T10:30:00Z'),true);
assert.equal(inboxDeleted(states[0],'2026-11-10T11:00:01Z'),false,'new direct message restores a deleted conversation');
states=applyInboxAction(states,'group:group-id','delete','2026-11-10T11:00:00Z');assert.equal(states[1].kind,'group');assert.equal(inboxDeleted(states[1],'2026-11-10T12:00:00Z'),true,'left group cannot be resurrected by later group messages');
states=applyInboxAction(states,'peer','clear','2026-11-10T12:00:00Z');assert.equal(states[1].deleted,false);assert.equal(states[1].archived,true,'clearing does not silently unarchive');
// Run the actual horizontal gesture and ensure its synthetic click cannot open a conversation.
let handlers,opened=null,canPress;
class Value{constructor(v){this.v=v;}setValue(v){this.v=v;}stopAnimation(cb){cb?.(this.v);}interpolate(config){return {config};}}
const jsx=(type,props)=>({type,props});
const react={useRef:v=>({current:v}),useEffect:f=>f(),useMemo:f=>f(),useCallback:f=>f,useState:v=>[400,()=>{}]};react.default=react;
const mod={exports:{}};
vm.runInNewContext(transpile('src/components/chat/ChatInboxSwipeRow.tsx'),{module:mod,exports:mod.exports,Date,require:id=>id==='react'?react:id==='react/jsx-runtime'?{jsx,jsxs:jsx}:id==='react-native'?{Animated:{Value,View:'AnimatedView',spring:(v,{toValue})=>({start(){v.setValue(toValue);}})},PanResponder:{create:h=>{handlers=h;return {panHandlers:{}};}},Platform:{OS:'web'},View:'View',Text:'Text',TouchableOpacity:'Button',StyleSheet:{create:x=>x}}:id==='react-i18next'?{useTranslation:()=>({t:k=>k})}:{MaterialCommunityIcons:'Icon'}});
mod.exports.ChatInboxSwipeRow({id:'peer',opened:null,onOpen:id=>opened=id,onMore(){},onArchive(){},archived:false,disabled:false,children:(f,metaStyle)=>{canPress=f;assert.equal(metaStyle.width.config.outputRange[0],0);assert.equal(metaStyle.opacity.config.outputRange[0],0);return null;}});
handlers.onStartShouldSetPanResponderCapture();assert.equal(handlers.onMoveShouldSetPanResponderCapture(null,{dx:4,dy:20}),false,'vertical scroll stays with the list');assert.equal(handlers.onMoveShouldSetPanResponderCapture(null,{dx:-30,dy:1}),true);
handlers.onPanResponderGrant();handlers.onPanResponderMove(null,{dx:-160,dy:0});handlers.onPanResponderRelease(null,{vx:-.2});assert.equal(opened,'peer');assert.equal(canPress(),false,'release click must not open the conversation');
console.log('PASS personal inbox state, clear/delete semantics, new-message restoration, group retention and swipe/tap separation');
