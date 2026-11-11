import {useEffect,useRef,useState} from 'react';
import {useAudioPlayer} from './useAudioPlayer';
import {usePlayerStore} from '../store/playerStore';
import {useChatListeningStore} from '../store/chatListeningStore';
import {stationService} from '../services/stationService';
import type {RadioGift} from '../utils/chatRadio';
const starts=new Set<string>();
/** One playback path for message cards and their pinned shortcut. */
export function useChatRadioPlayback({gift,messageId,partnerId,preview,owner,groupId,staged=false,standalone=false,presenceEnabled=true}:{gift:RadioGift;messageId:string;partnerId:string;preview:boolean;owner:string;groupId?:string;staged?:boolean;standalone?:boolean;presenceEnabled?:boolean}){
 const audio=useAudioPlayer(),stationId=usePlayerStore(s=>s.currentStation?._id),state=usePlayerStore(s=>s.playbackState);
 const [busy,setBusy]=useState(false),[error,setError]=useState(false),locked=useRef(false),alive=useRef(true),identity=useRef('');
 const key=`${owner}:${groupId||partnerId}:${messageId}:${gift.stationId}`;identity.current=key;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{setError(false);},[key]);
 const play=async()=>{
  const sharedKey=`${owner}:${groupId||partnerId}:${gift.stationId}`;if(locked.current||starts.has(sharedKey))return;starts.add(sharedKey);const request=identity.current;locked.current=true;setBusy(true);setError(false);
  try{
   if(!presenceEnabled||staged||standalone&&!groupId)useChatListeningStore.getState().setActive(null);
   const player=usePlayerStore.getState();
   if(player.currentStation?._id===gift.stationId&&player.playbackState==='playing'){audio.pause();return;}
   const station=await stationService.getStation(gift.stationId);
   if(!alive.current||identity.current!==request)return;if(!station)throw Error('Unavailable');
   const current=usePlayerStore.getState();
   if(!(current.currentStation?._id===gift.stationId&&current.playbackState==='playing'))await audio.playStation(station,{kind:'browse'});
   if(alive.current&&identity.current===request&&presenceEnabled&&!staged&&(!standalone||!!groupId)&&usePlayerStore.getState().currentStation?._id===gift.stationId)
    useChatListeningStore.getState().setActive({messageId,stationId:gift.stationId,partnerId,preview,owner,...(groupId?{groupId}:{})});
  }catch{if(alive.current&&identity.current===request)setError(true);}finally{starts.delete(sharedKey);locked.current=false;if(alive.current)setBusy(false);}
 };
 return {playing:stationId===gift.stationId&&state==='playing',busy,error,play};
}
