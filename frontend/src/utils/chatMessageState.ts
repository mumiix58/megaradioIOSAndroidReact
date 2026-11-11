import type {ChatMessage} from '../services/chatService';
/** Tombstones and personal hiding must win over stale pages and other preview tabs. */
export function mergeChatMessage(previous:ChatMessage|undefined,next:ChatMessage):ChatMessage{
 const hiddenFor=[...new Set([...(previous?.hiddenFor||[]),...(next.hiddenFor||[])])];
 const deletedAt=previous?.deletedAt||next.deletedAt;
 const pin=previous?.pinUpdatedAt&&Date.parse(previous.pinUpdatedAt)>Date.parse(next.pinUpdatedAt||'1970-01-01')?{pinnedAt:previous.pinnedAt,pinUpdatedAt:previous.pinUpdatedAt}:{};
 return {...previous,...next,...pin,...(hiddenFor.length?{hiddenFor}:{}),...(deletedAt?{deletedAt,content:'',imageUrl:undefined,replyTo:undefined,replyToId:undefined,pinnedAt:null,messageType:'text' as const}:{})};
}
export function deleteChatMessage(messages:ChatMessage[],id:string,scope:'self'|'everyone',viewer:string,at=new Date().toISOString()):ChatMessage[]{
 return messages.map(message=>message._id!==id?message:mergeChatMessage(message,scope==='self'?{...message,hiddenFor:[...(message.hiddenFor||[]),viewer]}:{...message,deletedAt:at}));
}
export function visibleChatMessages(messages:ChatMessage[],viewer:string):ChatMessage[]{return messages.filter(message=>!message.hiddenFor?.includes(viewer));}
