import api from './api';
import type {ChatUser,ChatMessage} from './chatService';
export interface GroupRadioPresence {userId:string;groupId:string;stationId:string;name:string;logo?:string;expiresAt:number}
export interface GroupMember {listening?:GroupRadioPresence;user:ChatUser;role:'admin'|'member';status:'active'|'invited'}
export interface ChatGroup {genres?:string[];createdBy?:string;invitedBy?:ChatUser;_id:string;name:string;avatar?:string;role:'admin'|'member';status:'active'|'invited'|'left';memberCount?:number;members?:GroupMember[];lastMessage?:string;lastMessageDeleted?:boolean;lastSender?:string;lastSenderId?:string;lastMessageAt?:string;unreadCount?:number}
export interface GroupMessage extends ChatMessage {groupId:string;sender?:ChatUser}
export const groupChatService={
 list:async():Promise<ChatGroup[]> =>(await api.get('/api/messages/groups')).data.groups,
 create:async(input:{name:string;memberIds:string[];avatar?:string;genres?:string[]}):Promise<string>=>(await api.post('/api/messages/groups',input)).data.groupId,
 info:async(id:string):Promise<ChatGroup>=>(await api.get(`/api/messages/groups/${id}`)).data.group,
 messages:async(id:string,before?:string):Promise<{messages:GroupMessage[];hasMore:boolean;pinnedMessages?:GroupMessage[]}>=>(await api.get(`/api/messages/groups/${id}/messages`,{params:{before}})).data,
 send:async(id:string,input:{content:string;messageType:string;imageUrl?:string;replyToId?:string}):Promise<GroupMessage>=>(await api.post(`/api/messages/groups/${id}/messages`,input)).data.message,
 delete:async(id:string,messageId:string,scope:'self'|'everyone')=>{await api.post(`/api/messages/groups/${id}/delete`,{messageId,scope});},
 pin:async(id:string,messageId:string,pinned:boolean):Promise<GroupMessage>=>(await api.post(`/api/messages/groups/${id}/pin`,{messageId,pinned})).data.message,
 respond:async(id:string,accept:boolean)=>{await api.post(`/api/messages/groups/${id}/respond`,{accept});},
 role:async(id:string,userId:string,role:'admin'|'member')=>{await api.post(`/api/messages/groups/${id}/role`,{userId,role});},
 photo:async(id:string,avatar:string|null)=>{await api.post(`/api/messages/groups/${id}/photo`,{avatar});},
 genres:async(id:string,genres:string[])=>{await api.post(`/api/messages/groups/${id}/genres`,{genres});},
 leave:async(id:string)=>{await api.post(`/api/messages/groups/${id}/leave`);},
};
