import {useLayoutEffect,useRef,useState} from 'react';
import type {View} from 'react-native';
import type {ChatMessage} from '../services/chatService';
import type {MessageActionAnchor} from '../components/chat/ChatMessageActions';
/** One interaction state machine for direct messages and group messages. */
export function useChatMessageMenu<T extends ChatMessage>(key:string){
 const [actionMessage,setActionMessage]=useState<T|null>(null),[deleting,setDeleting]=useState(false),[deleteError,setDeleteError]=useState('');
 const [selecting,setSelecting]=useState(false),[selectedIds,setSelectedIds]=useState<string[]>([]),[deleteConfirm,setDeleteConfirm]=useState(false);
 const [replyMessage,setReplyMessage]=useState<T|null>(null),[actionAnchor,setActionAnchor]=useState<MessageActionAnchor|null>(null);
 const messageNodes=useRef(new Map<string,View>()),identity=useRef(key);identity.current=key;
 useLayoutEffect(()=>{setActionMessage(null);setActionAnchor(null);setSelecting(false);setSelectedIds([]);setDeleteConfirm(false);setDeleting(false);setDeleteError('');setReplyMessage(null);},[key]);
 const cancelSelection=()=>{if(deleting)return;setSelecting(false);setSelectedIds([]);setDeleteConfirm(false);setDeleteError('');};
 const toggleSelected=(id:string)=>{if(!deleting)setSelectedIds(ids=>ids.includes(id)?ids.filter(value=>value!==id):[...ids,id]);};
 const openMessageActions=(message:T)=>{if(selecting){toggleSelected(message._id);return;}const version=identity.current;messageNodes.current.get(message._id)?.measureInWindow((x,y,width,height)=>{if(version!==identity.current||!width||!height)return;setActionAnchor({x,y,width,height});setDeleteError('');setActionMessage(message);});};
 return {actionMessage,setActionMessage,deleting,setDeleting,deleteError,setDeleteError,selecting,setSelecting,selectedIds,setSelectedIds,deleteConfirm,setDeleteConfirm,replyMessage,setReplyMessage,actionAnchor,setActionAnchor,messageNodes,cancelSelection,toggleSelected,openMessageActions};
}
