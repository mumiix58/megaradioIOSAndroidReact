import React from 'react';
import {useTranslation} from 'react-i18next';
import {ChatContextMenu,type ChatContextAction,type ContextMenuAnchor} from './ChatContextMenu';
export type MessageActionAnchor=ContextMenuAnchor;
export function ChatMessageActions({visible,anchor,mine,deleted,pinned,busy,error,onClose,onSelect,onReply,onCopy,onPin}:{visible:boolean;anchor:MessageActionAnchor|null;mine:boolean;deleted:boolean;pinned:boolean;busy:boolean;error:string;onClose:()=>void;onSelect:()=>void;onReply:()=>void;onCopy:()=>void;onPin:()=>void}){
 const {t}=useTranslation();
 const actions:ChatContextAction[]=[...(!deleted?[{id:'reply',label:t('chat_reply'),icon:'reply-outline' as const,run:onReply},{id:'copy',label:t('chat_copy'),icon:'content-copy' as const,run:onCopy},{id:'pin',label:t(pinned?'chat_unpin':'chat_pin'),icon:pinned?'pin-off-outline' as const:'pin-outline' as const,run:onPin}]:[]),{id:'delete',label:t('chat_delete'),icon:'delete-outline',run:onSelect,danger:true}];
 return <ChatContextMenu {...{visible,anchor,busy,error,onClose,actions}} rightAligned={mine} prefix="chat" menuTestID="chat-message-menu" dismissTestID="chat-delete-cancel"/>;
}
