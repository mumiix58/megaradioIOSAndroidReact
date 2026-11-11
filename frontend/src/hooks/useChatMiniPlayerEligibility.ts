import {useEffect,useState} from 'react';
import {usePlayerStore} from '../store/playerStore';
/** A paused station from an earlier visit must not open a player in a new conversation. */
export function useChatMiniPlayerEligibility(key:string,focused:boolean){
 const stationId=usePlayerStore(s=>s.currentStation?._id),state=usePlayerStore(s=>s.playbackState);
 const [armed,setArmed]=useState<{key:string;stationId:string}|null>(null);
 useEffect(()=>{
  setArmed(previous=>{
   if(!focused||!stationId||state==='idle'||state==='error')return null;
   if(state==='playing')return previous?.key===key&&previous.stationId===stationId?previous:{key,stationId};
   return previous?.key===key&&previous.stationId===stationId?previous:null;
  });
 },[key,focused,stationId,state]);
 // Keep controls after pausing a radio started during this visit, so it can be resumed.
 return focused&&!!stationId&&(state==='playing'||!!armed&&armed.key===key&&armed.stationId===stationId&&state!=='idle'&&state!=='error');
}
