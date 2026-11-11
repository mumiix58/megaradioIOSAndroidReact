const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/chatMessageState.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,Date});
const {deleteChatMessage,mergeChatMessage,visibleChatMessages}=mod.exports;
const message={_id:'one',fromUserId:'sender',toUserId:'receiver',content:'private contents',imageUrl:'/uploads/chat/a.jpg',messageType:'image',read:false,createdAt:'2026-11-09T11:00:00Z'};
const hidden=deleteChatMessage([message],'one','self','receiver');assert.equal(visibleChatMessages(hidden,'receiver').length,0);assert.equal(visibleChatMessages(hidden,'sender').length,1);
const tombstone=deleteChatMessage([message],'one','everyone','sender','2026-11-09T12:00:00Z')[0];assert.equal(tombstone.content,'');assert.equal(tombstone.imageUrl,undefined);assert.equal(tombstone.createdAt,message.createdAt);
for(const merged of [mergeChatMessage(tombstone,message),mergeChatMessage(message,tombstone)]){assert.equal(merged.content,'');assert.equal(merged.imageUrl,undefined);assert.ok(merged.deletedAt);}
const combined=mergeChatMessage(hidden[0],tombstone);assert.equal(visibleChatMessages([combined],'receiver').length,0);assert.equal(visibleChatMessages([combined],'sender').length,1);assert.equal(combined.content,'');
assert.equal(message.content,'private contents');console.log('PASS personal hiding, shared tombstones, attachment scrubbing and stale-page resurrection protection');

const pinned={...message,pinnedAt:'2026-11-09T12:00:00Z',pinUpdatedAt:'2026-11-09T12:00:00Z'},unpin={...message,pinnedAt:null,pinUpdatedAt:'2026-11-09T12:01:00Z'};assert.equal(mergeChatMessage(unpin,pinned).pinnedAt,null);assert.equal(mergeChatMessage(pinned,unpin).pinnedAt,null);
