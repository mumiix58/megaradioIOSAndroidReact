import React,{useEffect,useRef} from 'react';
import {Animated,Text,StyleSheet,AccessibilityInfo,Platform} from 'react-native';

/** The profile scene ends above the tab/player dock, so bottom:16 clears both. */
export function ProfilePhotoFeedback({notice,onDismiss,durationMs}:{notice:{error:boolean;message:string};onDismiss:()=>void;durationMs?:number}){
 const progress=useRef(new Animated.Value(0)).current;
 useEffect(()=>{
  let active=true;let timer:ReturnType<typeof setTimeout>|undefined;
  progress.setValue(0);
  const enter=Animated.timing(progress,{toValue:1,duration:180,useNativeDriver:true});enter.start();
  if(Platform.OS!=='web')AccessibilityInfo.announceForAccessibility(notice.message);
  const schedule=async()=>{
   const base=durationMs ?? (notice.error?9000:7000);
   let duration=base;
   if(Platform.OS==='android'){
    try{duration=Math.max(base,await AccessibilityInfo.getRecommendedTimeoutMillis(base));}catch{}
   }
   if(!active)return;
   timer=setTimeout(()=>Animated.timing(progress,{toValue:0,duration:160,useNativeDriver:true}).start(({finished})=>{if(finished&&active)onDismiss();}),duration);
  };
  void schedule();
  return()=>{active=false;if(timer)clearTimeout(timer);enter.stop();progress.stopAnimation();};
 },[notice,onDismiss,progress,durationMs]);
 return <Animated.View testID="profile-photo-notice" accessibilityLiveRegion="polite" pointerEvents="none" style={[s.position,{opacity:progress,transform:[{translateY:progress.interpolate({inputRange:[0,1],outputRange:[6,0]})}]}]}>
  <Text style={s.message}>{notice.message}</Text>
 </Animated.View>;
}
const s=StyleSheet.create({position:{position:'absolute',bottom:16,alignSelf:'center',width:302,maxWidth:'90%',zIndex:100,elevation:15,minHeight:64,paddingHorizontal:20,paddingVertical:20,borderRadius:6,backgroundColor:'#000000',borderWidth:1,borderColor:'#292929',alignItems:'center',justifyContent:'center',shadowColor:'#000',shadowOpacity:.25,shadowRadius:12,shadowOffset:{width:0,height:4}},message:{fontFamily:'Ubuntu-Medium',fontSize:15,lineHeight:20,textAlign:'center',color:'#FFFFFF'}});
