import AsyncStorage from '@react-native-async-storage/async-storage';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Platform} from 'react-native';
import {parseChatLists,type ChatList} from '../utils/chatInboxLists';
const writes=new Map<string,Promise<void>>();
export function useChatInboxLists(owner:string){
 const client=useQueryClient(),key=['chat-personal-lists',owner];
 const storageKey=`megaradio-chat-lists-v1:${owner}`;
 const query=useQuery({queryKey:key,enabled:!!owner&&(Platform.OS!=='web'||typeof window!=='undefined'),queryFn:async()=>parseChatLists(await AsyncStorage.getItem(storageKey)),staleTime:Infinity});
 const save=async(next:ChatList[])=>{
  if(!owner)throw new Error('No owner');
  const pending=(writes.get(storageKey)||Promise.resolve()).catch(()=>{}).then(()=>AsyncStorage.setItem(storageKey,JSON.stringify(next)));
  writes.set(storageKey,pending);
  try{await pending;client.setQueryData(key,next);}finally{if(writes.get(storageKey)===pending)writes.delete(storageKey);}
 };
 return {lists:query.data||[],ready:query.isSuccess,save};
}
