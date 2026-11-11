import {useEffect,useRef} from 'react';
import {AccessibilityInfo,Animated,AppState,Easing,Platform} from 'react-native';

type Track={value:Animated.Value;users:number;duration:number;loop:Animated.CompositeAnimation|null};
const tracks=new Map<string,Track>();
let listeners=0,generation=0,motionRevision=0,reduced=false,foreground=AppState.currentState!=='background';
let motionSubscription:ReturnType<typeof AccessibilityInfo.addEventListener>|undefined;
let appSubscription:ReturnType<typeof AppState.addEventListener>|undefined;
function update(track:Track){
 if(track.users&&foreground&&!reduced){
  if(track.loop)return;
  track.value.setValue(0);
  track.loop=Animated.loop(Animated.timing(track.value,{toValue:1,duration:track.duration,easing:Easing.linear,useNativeDriver:Platform.OS!=='web',isInteraction:false}));
  track.loop.start();
 }else{track.loop?.stop();track.loop=null;track.value.setValue(0);}
}
function subscribe(track:Track){
 track.users++;listeners++;
 if(listeners===1){
  const version=++generation,revision=motionRevision;
  foreground=AppState.currentState!=='background';
  void AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(generation===version&&listeners&&motionRevision===revision){reduced=value;tracks.forEach(update);}}).catch(()=>{});
  motionSubscription=AccessibilityInfo.addEventListener('reduceMotionChanged',value=>{motionRevision++;reduced=value;tracks.forEach(update);});
  appSubscription=AppState.addEventListener('change',value=>{foreground=value==='active';tracks.forEach(update);});
 }
 update(track);
 return()=>{track.users--;listeners--;update(track);if(!listeners){generation++;motionSubscription?.remove();appSubscription?.remove();motionSubscription=undefined;appSubscription=undefined;}};
}
/** Many placeholders share one animation clock; no loop/listener for every card. */
export function useSharedLoadingMotion(kind:'ring'|'shimmer'){
 const reference=useRef<Track|null>(null);
 if(!reference.current){let track=tracks.get(kind);if(!track){track={value:new Animated.Value(0),users:0,duration:kind==='ring'?800:1200,loop:null};tracks.set(kind,track);}reference.current=track;}
 const track=reference.current;
 useEffect(()=>subscribe(track),[track]);
 return track.value;
}
