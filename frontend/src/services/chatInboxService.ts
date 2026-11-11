import api from './api';
export type InboxAction='archive'|'unarchive'|'mute'|'unmute'|'unread'|'read'|'clear'|'delete';
export type InboxState={kind:'direct'|'group';targetId:string;archived:boolean;muted:boolean;markedUnread:boolean;deleted:boolean;readAt?:string;clearedAt?:string;deletedAt?:string};
export const inboxId=(state:Pick<InboxState,'kind'|'targetId'>)=>state.kind==='group'?`group:${state.targetId}`:state.targetId;
export const chatInboxService={
 list:async():Promise<InboxState[]>=>(await api.get('/api/messages/inbox-state')).data.states,
 act:async(kind:InboxState['kind'],targetId:string,action:InboxAction):Promise<InboxState[]>=>(await api.post('/api/messages/inbox-state',{kind,targetId,action})).data.states,
};
export function applyInboxAction(states:InboxState[],id:string,action:InboxAction,now=new Date().toISOString()):InboxState[]{
 const kind=id.startsWith('group:')?'group':'direct',targetId=kind==='group'?id.slice(6):id;
 const old=states.find(s=>inboxId(s)===id)||{kind,targetId,archived:false,muted:false,markedUnread:false,deleted:false};
 const next={...old};
 if(action==='archive'||action==='unarchive')next.archived=action==='archive';
 if(action==='mute'||action==='unmute')next.muted=action==='mute';
 if(action==='read'||action==='unread')next.markedUnread=action==='unread';if(action==='read')next.readAt=now;
 if(action==='clear'||action==='delete'){next.clearedAt=now;next.markedUnread=false;next.deleted=action==='delete';next.deletedAt=action==='delete'?now:undefined;}
 return [...states.filter(s=>inboxId(s)!==id),next];
}
export function inboxDeleted(state:InboxState|undefined,lastMessageAt?:string){return !!state?.deleted&&!(state.kind==='direct'&&state.deletedAt&&lastMessageAt&&Date.parse(lastMessageAt)>Date.parse(state.deletedAt));}
