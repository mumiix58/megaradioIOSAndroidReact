import AsyncStorage from '@react-native-async-storage/async-storage';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useRef} from 'react';
import {chatInboxService,applyInboxAction,inboxId,type InboxAction,type InboxState} from '../services/chatInboxService';
const writes=new Map<string,Promise<unknown>>();
export function useChatInboxState(owner:string,preview:boolean){
 const client=useQueryClient(),key=['chat-inbox-state',owner,preview],storage=`megaradio-inbox-actions-v1:${owner}`,lock=useRef(false);
 const query=useQuery({queryKey:key,enabled:!!owner,queryFn:async()=>{if(!preview)return chatInboxService.list();try{const parsed=JSON.parse(await AsyncStorage.getItem(storage)||'[]');return Array.isArray(parsed)?parsed as InboxState[]:[];}catch{return [];}},staleTime:preview?Infinity:15000});
 const act=async(id:string,action:InboxAction)=>{
  if(!owner||!query.isSuccess||lock.current)throw Error('Inbox not ready');lock.current=true;
  try{
   let next:InboxState[];
   if(preview){const task=(writes.get(storage)||Promise.resolve()).catch(()=>{}).then(async()=>{const current=JSON.parse(await AsyncStorage.getItem(storage)||'[]');const next=applyInboxAction(current,id,action);await AsyncStorage.setItem(storage,JSON.stringify(next));return next;});writes.set(storage,task);next=await task; if(writes.get(storage)===task)writes.delete(storage);}
   else next=await chatInboxService.act(id.startsWith('group:')?'group':'direct',id.startsWith('group:')?id.slice(6):id,action);
   client.setQueryData(key,next);
   if(!preview)for(const prefix of ['chat-conversations','chat-groups','chat-thread','chat-group-messages','chat-unread','notifications'])void client.invalidateQueries({queryKey:[prefix,...(prefix==='notifications'?[]:[owner])]});
  }finally{lock.current=false;}
 };
 const states=query.data||[];
 return {states,ready:query.isSuccess,error:query.isError,act,get:(id:string)=>states.find(s=>inboxId(s)===id)};
}
