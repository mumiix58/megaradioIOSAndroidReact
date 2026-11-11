import {parseRadioGift} from './chatRadio';
import type {ChatGroup} from '../services/groupChatService';
/** Calendar days in the device timezone, not a rolling 24-hour cutoff. */
export function formatInboxTime(value:string|undefined,language:string,yesterday:string,now=new Date()):string{
 if(!value)return '';const date=new Date(value);if(!Number.isFinite(date.getTime()))return '';
 const day=(d:Date)=>`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
 if(day(date)===day(now))return date.toLocaleTimeString(language,{hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const previous=new Date(now);previous.setDate(previous.getDate()-1);if(day(date)===day(previous))return yesterday;
 return date.toLocaleDateString(language,{day:'numeric',month:'short',...(date.getFullYear()!==now.getFullYear()?{year:'numeric'}:{})});
}
export function groupInboxPreview(group:Pick<ChatGroup,'status'|'lastMessage'|'lastMessageDeleted'|'lastSender'|'lastSenderId'>,owner:string,t:(key:string)=>string){
 if(group.status==='invited')return {sender:'',body:t('group_invitation')};
 if(group.status==='left')return {sender:'',body:t('inbox_left')};
 const body=group.lastMessageDeleted?t('chat_deleted'):parseRadioGift(group.lastMessage||'')?t('chat_radio_shared_preview'):group.lastMessage||t('group_first_message');
 const sender=group.lastMessage||group.lastMessageDeleted?(group.lastSenderId===owner?t('chat_you'):group.lastSender?.trim()||''):'';
 return {sender,body};
}
