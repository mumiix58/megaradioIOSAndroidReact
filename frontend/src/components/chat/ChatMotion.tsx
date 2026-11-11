import React, { useEffect, useRef } from 'react';
import { Animated, View, AccessibilityInfo, Platform } from 'react-native';
export function ChatMessageMotion({children,recent,style}:{children:React.ReactNode;recent:boolean;style:any}){
 const progress=useRef(new Animated.Value(1)).current;
 useEffect(()=>{let alive=true;let motion:Animated.CompositeAnimation|undefined;if(recent)void AccessibilityInfo.isReduceMotionEnabled().then(reduce=>{if(!alive||reduce)return;progress.setValue(0);motion=Animated.timing(progress,{toValue:1,duration:180,useNativeDriver:Platform.OS!=='web'});motion.start();});return()=>{alive=false;motion?.stop();};},[]);
 return <Animated.View style={[style,{opacity:progress,transform:[{translateY:progress.interpolate({inputRange:[0,1],outputRange:[7,0]})}]}]}>{children}</Animated.View>;
}
export function ChatTypingDots({label}:{label:string}){
 const values=useRef([new Animated.Value(0),new Animated.Value(0),new Animated.Value(0)]).current;
 useEffect(()=>{let alive=true;let motion:Animated.CompositeAnimation|undefined;void AccessibilityInfo.isReduceMotionEnabled().then(reduce=>{if(!alive||reduce)return;motion=Animated.loop(Animated.stagger(130,values.map(value=>Animated.sequence([Animated.timing(value,{toValue:1,duration:220,useNativeDriver:Platform.OS!=='web'}),Animated.timing(value,{toValue:0,duration:220,useNativeDriver:Platform.OS!=='web'}),Animated.delay(450)]))));motion.start();});return()=>{alive=false;motion?.stop();};},[values]);
 return <View accessibilityLabel={label} style={{alignSelf:'flex-start',marginLeft:16,marginBottom:8,paddingHorizontal:17,paddingVertical:15,borderRadius:20,borderBottomLeftRadius:5,backgroundColor:'#292A2F',flexDirection:'row',gap:5}}>{values.map((value,index)=><Animated.View key={index} style={{width:6,height:6,borderRadius:3,backgroundColor:'#BFB5C6',transform:[{translateY:value.interpolate({inputRange:[0,1],outputRange:[0,-4]})}]}}/>)}</View>;
}
