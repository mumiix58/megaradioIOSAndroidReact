import React,{useEffect,useRef} from 'react';
import {AccessibilityInfo,Animated,Platform,StyleSheet,Text,View} from 'react-native';

/** Reserve the same header space in every playback state; pulse opacity only. */
export function ChatLiveBadge({active,label}:{active:boolean;label:string}){
 const glow=useRef(new Animated.Value(1)).current;
 useEffect(()=>{
  let alive=true,motion:Animated.CompositeAnimation|undefined;
  glow.setValue(1);
  if(active)void AccessibilityInfo.isReduceMotionEnabled().then(reduce=>{
   if(!alive||reduce)return;
   motion=Animated.loop(Animated.sequence([Animated.delay(2400),Animated.timing(glow,{toValue:.3,duration:650,useNativeDriver:Platform.OS!=='web'}),Animated.timing(glow,{toValue:1,duration:650,useNativeDriver:Platform.OS!=='web'})]));motion.start();
  });
  return()=>{alive=false;motion?.stop();glow.setValue(1);};
 },[active,glow]);
 return <View testID="chat-radio-live" pointerEvents="none" aria-hidden={!active} accessible={active} accessibilityLabel={active?label:undefined} accessibilityElementsHidden={!active} importantForAccessibility={active?'yes':'no-hide-descendants'} style={[s.badge,{opacity:active?1:0}]}>{active&&<><Animated.View style={[s.dot,{opacity:glow}]}/><Text style={s.label}>LIVE</Text></>}</View>;
}
const s=StyleSheet.create({badge:{width:49,height:24,flexShrink:0,flexDirection:'row',alignItems:'center',justifyContent:'flex-end',gap:5},dot:{width:5,height:5,borderRadius:3,backgroundColor:'#68DDA7'},label:{fontFamily:'Ubuntu-Medium',fontSize:10,lineHeight:14,letterSpacing:.6,color:'#91E5BD'}});
