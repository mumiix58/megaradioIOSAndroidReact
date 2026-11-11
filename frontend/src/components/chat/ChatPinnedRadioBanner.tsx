import React,{useEffect,useState} from 'react';
import {ChatPinnedBanner} from './ChatThreadControls';
import {useChatRadioPlayback} from '../../hooks/useChatRadioPlayback';
import {useChatListeningStore} from '../../store/chatListeningStore';
import type {ChatUser} from '../../services/chatService';
import type {RadioGift} from '../../utils/chatRadio';
export type PinnedRadioListener={user:ChatUser;stationId?:string;expiresAt:number};
export function currentRadioListeners(listeners:PinnedRadioListener[],stationId:string,owner:string,now:number){
 const unique=new Map<string,ChatUser>();for(const entry of listeners)if(entry.user._id!==owner&&entry.stationId===stationId&&entry.expiresAt>now)unique.set(entry.user._id,entry.user);return [...unique.values()];
}
/** The text pin keeps its original layout. A radio adds a small control and a live avatar rail. */
export function ChatPinnedRadioBanner({gift,messageId,owner,ownerPerson,partnerId='',preview,groupId,presenceEnabled=true,listeners=[],summary,count,busy,onJump,onUnpin}:{gift:RadioGift|null;messageId:string;owner:string;ownerPerson?:ChatUser|null;partnerId?:string;preview:boolean;groupId?:string;presenceEnabled?:boolean;listeners?:PinnedRadioListener[];summary:string;count:number;busy:boolean;onJump:()=>void;onUnpin:()=>void}){
 // Keep the generic banner free of audio subscriptions for ordinary text pins.
 return gift?<RadioPin key={`${owner}:${groupId||partnerId}:${messageId}:${gift.stationId}`} {...{gift,messageId,owner,ownerPerson,partnerId,preview,groupId,presenceEnabled,listeners,summary,count,busy,onJump,onUnpin}}/>:<ChatPinnedBanner {...{summary,count,busy,onJump,onUnpin}}/>;
}
function RadioPin({gift,messageId,owner,ownerPerson,partnerId,preview,groupId,presenceEnabled,listeners,summary,count,busy,onJump,onUnpin}:Required<Pick<React.ComponentProps<typeof ChatPinnedRadioBanner>,'gift'|'partnerId'|'listeners'>>&Omit<React.ComponentProps<typeof ChatPinnedRadioBanner>,'gift'|'partnerId'|'listeners'>){
 const radio=gift!,playback=useChatRadioPlayback({gift:radio,messageId,owner,partnerId,preview,groupId,presenceEnabled}),active=useChatListeningStore(s=>s.active),[now,setNow]=useState(Date.now());
 const expiry=listeners.map(entry=>`${entry.user._id}:${entry.stationId}:${entry.expiresAt}`).join('|');
 useEffect(()=>{const next=Math.min(...listeners.map(entry=>entry.expiresAt).filter(at=>at>Date.now()));if(!Number.isFinite(next))return;const timer=setTimeout(()=>setNow(Date.now()),Math.max(1,next-Date.now()+30));return()=>clearTimeout(timer);},[expiry,now]);
 const users=currentRadioListeners(listeners,radio.stationId,owner,Math.max(now,Date.now()));
 const sharingHere=presenceEnabled&&active?.owner===owner&&active.stationId===radio.stationId&&(groupId?active.groupId===groupId:!active.groupId&&active.partnerId===partnerId);
 if(playback.playing&&sharingHere)users.unshift(ownerPerson||{_id:owner});
 return <ChatPinnedBanner {...{summary,count,busy,onJump,onUnpin}} radio={{playing:playback.playing,busy:playback.busy,error:playback.error,onPlay:playback.play,listeners:users}}/>;
}
