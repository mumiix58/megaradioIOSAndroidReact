import {create} from 'zustand';
import {visibleChatMessages} from '../utils/chatMessageState';
import {Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {previewConversations,CHAT_PREVIEW_OWNER} from '../fixtures/chatPreview';
import type {ChatGroup,GroupMessage} from '../services/groupChatService';
const people=previewConversations.map(c=>c.partner!);
const member=(index:number)=>({user:people[index],role:'member' as const,status:'active' as const});
const me={user:{_id:CHAT_PREVIEW_OWNER,fullName:'Sen'},role:'admin' as const,status:'active' as const};
const groups:ChatGroup[]=[{_id:'demo-group-night',name:'Gece Frekansı',createdBy:CHAT_PREVIEW_OWNER,role:'admin',status:'active',memberCount:4,members:[me,member(0),member(1),member(4)],lastMessage:'Bu akşam jazz ile başlayalım 🎷',lastSender:'Deniz',lastMessageAt:new Date().toISOString(),unreadCount:2},{_id:'demo-group-road',name:'Yol Arkadaşları',createdBy:people[2]._id,role:'member',status:'active',memberCount:3,members:[{...me,role:'member'},{...member(2),role:'admin'},member(3)],lastMessage:'Yola çıkınca aynı radyodayız 🚗',lastSender:'Lina',lastMessageAt:new Date(Date.now()-3600000).toISOString()},{_id:'demo-group-invite',name:'Sabah Kahvesi',invitedBy:people[5],role:'member',status:'invited',lastMessageAt:new Date(Date.now()-7200000).toISOString()}];
const msg=(groupId:string,index:number,sender:number,content:string):GroupMessage=>({_id:`${groupId}-${index}`,groupId,fromUserId:people[sender]._id,toUserId:'',sender:people[sender],content,messageType:'text',read:true,createdAt:new Date(Date.now()-(10-index)*60000).toISOString()});
const threads:Record<string,GroupMessage[]>={'demo-group-night':[msg('demo-group-night',0,0,'Herkese selam! Akşamın radyosunu burada seçelim 📻'),msg('demo-group-night',1,1,'Ben kahvemi aldım, önerileri bekliyorum ☕'),msg('demo-group-night',2,4,'Bugün favorilerime çok iyi bir istasyon ekledim.'),msg('demo-group-night',3,0,'Bu akşam jazz ile başlayalım 🎷')],'demo-group-road':[msg('demo-group-road',0,2,'Yol için favori radyolarınızı paylaşın 🤘'),msg('demo-group-road',1,3,'Yola çıkınca aynı radyodayız 🚗')]};
export const useGroupPreviewStore=create<{
 groups:ChatGroup[];threads:Record<string,GroupMessage[]>;
 create:(name:string,ids:string[],avatar?:string,genres?:string[])=>string;
 send:(id:string,content:string,messageType:string,imageUrl?:string,replyTo?:GroupMessage|null)=>void;
 updateMessages:(id:string,update:(items:GroupMessage[])=>GroupMessage[])=>void;
 genres:(id:string,genres:string[])=>void;role:(id:string,userId:string,role:'admin'|'member')=>void;photo:(id:string,avatar:string|null)=>void;
 respond:(id:string,accept:boolean)=>void;leave:(id:string)=>void;
}>((set)=>({groups,threads,
 create:(name,ids,avatar,genres=[])=>{const id=`demo-group-${Date.now()}`,now=new Date().toISOString();set(s=>({groups:[{_id:id,name,avatar,genres:[...genres],createdBy:CHAT_PREVIEW_OWNER,role:'admin',status:'active',memberCount:1,members:[me,...ids.map(id=>({user:people.find(p=>p._id===id)!,role:'member' as const,status:'invited' as const}))],lastMessageAt:now},...s.groups],threads:{...s.threads,[id]:[]}}));return id;},
 send:(id,content,messageType,imageUrl,replyTo)=>{const message:GroupMessage={_id:`local-group-${Date.now()}`,groupId:id,fromUserId:CHAT_PREVIEW_OWNER,toUserId:'',sender:me.user,replyToId:replyTo?._id,replyTo:replyTo?{_id:replyTo._id,fromUserId:replyTo.fromUserId,content:replyTo.content,messageType:replyTo.messageType}:undefined,content,messageType:messageType as GroupMessage['messageType'],imageUrl,read:true,createdAt:new Date().toISOString()};set(s=>({threads:{...s.threads,[id]:[...(s.threads[id]||[]),message]},groups:s.groups.map(g=>g._id===id?{...g,lastMessage:content,lastSender:'Sen',lastSenderId:CHAT_PREVIEW_OWNER,lastMessageAt:message.createdAt}:g)}));},
 updateMessages:(id,update)=>set(s=>{const messages=update(s.threads[id]||[]),last=visibleChatMessages(messages,CHAT_PREVIEW_OWNER).at(-1);return {threads:{...s.threads,[id]:messages},groups:s.groups.map(group=>group._id===id?{...group,lastMessage:last?.content||'',lastMessageDeleted:!!last?.deletedAt,lastSenderId:last?.fromUserId,lastSender:last?.fromUserId===CHAT_PREVIEW_OWNER?'Sen':(last as GroupMessage|undefined)?.sender?.fullName||'',lastMessageAt:last?.createdAt||group.lastMessageAt}:group)};}),
 respond:(id,accept)=>set(s=>({groups:accept?s.groups.map(g=>g._id===id?{...g,status:'active',role:'member',members:[{...me,role:'member'},member(5)],memberCount:2}:g):s.groups.filter(g=>g._id!==id)})),
 role:(id,userId,role)=>set(s=>({groups:s.groups.map(g=>g._id===id&&g.role==='admin'?{...g,members:g.members?.map(m=>m.user._id===userId&&m.status==='active'&&!(userId===g.createdBy&&role==='member')?{...m,role}:m)}:g)})),
 genres:(id,genres)=>set(s=>({groups:s.groups.map(g=>g._id===id&&g.role==='admin'?{...g,genres:[...genres]}:g)})),
 photo:(id,avatar)=>set(s=>({groups:s.groups.map(g=>g._id===id&&g.role==='admin'?{...g,avatar:avatar||undefined}:g)})),
 leave:id=>set(s=>({groups:s.groups.map(g=>g._id===id?{...g,status:'left' as const,role:'member' as const,unreadCount:0}:g)})),
}));
if(typeof window!=='undefined'&&__DEV__&&Platform.OS==='web'&&process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY==='1'){
 let ready=false;
 void AsyncStorage.getItem('megaradio-group-preview-v1').then(raw=>{try{const stored=raw?JSON.parse(raw):null;const data=stored?.state||stored;if(Array.isArray(data?.groups)&&data.threads&&typeof data.threads==='object')useGroupPreviewStore.setState({groups:data.groups.map((g:ChatGroup)=>({...g,createdBy:g.createdBy||groups.find(seed=>seed._id===g._id)?.createdBy||(g.role==='admin'?CHAT_PREVIEW_OWNER:undefined)})),threads:data.threads});}catch{}finally{ready=true;}}).catch(()=>{ready=true;});
 useGroupPreviewStore.subscribe(state=>{if(ready)void AsyncStorage.setItem('megaradio-group-preview-v1',JSON.stringify({groups:state.groups,threads:state.threads})).catch(()=>{});});
}
