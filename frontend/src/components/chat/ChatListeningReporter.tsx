import {useEffect,useRef,useState} from 'react';
import {AppState} from 'react-native';
import {useAuthStore} from '../../store/authStore';
import {usePlayerStore} from '../../store/playerStore';
import {useChatListeningStore} from '../../store/chatListeningStore';
import api from '../../services/api';
/** A light heartbeat only for an explicitly opened chat station. No browsing history is shared. */
export function ChatListeningReporter(){
 const active=useChatListeningStore(s=>s.active),stationId=usePlayerStore(s=>s.currentStation?._id),state=usePlayerStore(s=>s.playbackState),{user,isAuthenticated}=useAuthStore(),[foreground,setForeground]=useState(AppState.currentState==='active');
 const clientId=useRef(`mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,12)}`),revision=useRef(0);
 const owner=isAuthenticated?user?._id||user?.id:'';
 useEffect(()=>{const sub=AppState.addEventListener('change',next=>setForeground(next==='active'));return()=>sub.remove();},[]);
 useEffect(()=>{if(active&&!active.preview&&(owner!==active.owner||stationId!==active.stationId))useChatListeningStore.getState().setActive(null);},[active,owner,stationId]);
 useEffect(()=>{if(!active||active.preview||owner!==active.owner)return;const listening=foreground&&stationId===active.stationId&&state==='playing';const report=(value:boolean)=>{void api.post(active.groupId?`/api/messages/groups/${active.groupId}/listening`:'/api/messages/listening',{...(active.groupId?{stationId:active.stationId}:{messageId:active.messageId}),listening:value,clientId:clientId.current,revision:++revision.current}).catch(()=>{});};report(listening);if(!listening)return;const interval=setInterval(()=>report(true),12000);return()=>{clearInterval(interval);report(false);};},[active,owner,stationId,state,foreground]);
 return null;
}
