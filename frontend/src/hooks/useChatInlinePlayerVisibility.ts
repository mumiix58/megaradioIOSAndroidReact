import {useMemo,useRef,useState} from 'react';
import type {ChatMessage} from '../services/chatService';
import type {ViewToken} from 'react-native';
import {usePlayerStore} from '../store/playerStore';
import {parseRadioGift} from '../utils/chatRadio';

/** Keep playback controls inline while a usable radio card is in the viewport. */
export function useChatInlinePlayerVisibility(key:string,messages:readonly ChatMessage[]){
 const stationId=usePlayerStore(state=>state.currentStation?._id);
 const [visible,setVisible]=useState<{key:string;ids:string[]}>({key,ids:[]});
 const currentKey=useRef(key);currentKey.current=key;
 const onViewableItemsChanged=useRef(({viewableItems}:{viewableItems:ViewToken[]})=>{
  const ids=viewableItems.filter(token=>token.isViewable).map(token=>String(token.item?._id||''));
  setVisible(previous=>previous.key===currentKey.current&&previous.ids.join(',')===ids.join(',')?previous:{key:currentKey.current,ids});
 }).current;
 const viewabilityConfig=useRef({itemVisiblePercentThreshold:50,minimumViewTime:0}).current;
 const viewabilityProps=useMemo(()=>({onViewableItemsChanged,viewabilityConfig}),[onViewableItemsChanged,viewabilityConfig]);
 return {inlineRadioVisible:!!stationId&&visible.key===key&&messages.some(message=>!message.deletedAt&&visible.ids.includes(message._id)&&parseRadioGift(message.content)?.stationId===stationId),viewabilityProps};
}
