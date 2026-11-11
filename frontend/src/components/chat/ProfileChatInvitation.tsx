import React, {useEffect, useRef, useState} from 'react';
import {AccessibilityInfo, Animated, AppState, Easing} from 'react-native';
import {useFocusEffect} from 'expo-router';
import {ChatIcon} from './ChatIcons';

/** A springy invitation, isolated from header layout and the chat permission gate. */
export function ProfileChatInvitation({active, paused, pressed}: {active:boolean; paused:boolean; pressed:boolean}) {
  const progress=useRef(new Animated.Value(0)).current;
  const touch=useRef(new Animated.Value(1)).current;
  const joy=useRef(new Animated.Value(0)).current;
  const wasActive=useRef(active);
  const [celebrating,setCelebrating]=useState(false);
  const [reduceMotion,setReduceMotion]=useState(true);
  const [foreground,setForeground]=useState(AppState.currentState!=='background');
  const [focused,setFocused]=useState(false);
  useFocusEffect(React.useCallback(()=>{setFocused(true);return()=>setFocused(false);},[]));
  useEffect(()=>{
    let mounted=true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(mounted)setReduceMotion(value);});
    const motion=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduceMotion);
    const app=AppState.addEventListener('change',state=>setForeground(state==='active'));
    return()=>{mounted=false;motion.remove();app.remove();};
  },[]);
  useEffect(()=>{
    progress.setValue(0);
    if(reduceMotion||!foreground||!focused||paused||celebrating)return;
    const animation=Animated.loop(Animated.sequence([
      Animated.delay(650),
      Animated.timing(progress,{toValue:1,duration:1850,easing:Easing.linear,useNativeDriver:true,isInteraction:false}),
      Animated.delay(3200),
      Animated.timing(progress,{toValue:0,duration:0,useNativeDriver:true,isInteraction:false}),
    ]));
    animation.start();
    return()=>{animation.stop();progress.setValue(0);};
  },[progress,reduceMotion,foreground,focused,paused,celebrating]);
  useEffect(()=>{
    const becameActive=active&&!wasActive.current;
    wasActive.current=active;
    if(!becameActive||reduceMotion||!foreground||!focused)return;
    setCelebrating(true);
    const celebration=Animated.sequence([
      Animated.timing(joy,{toValue:1,duration:1100,easing:Easing.linear,useNativeDriver:true,isInteraction:false}),
      Animated.timing(joy,{toValue:0,duration:0,useNativeDriver:true,isInteraction:false}),
    ]);
    celebration.start(({finished})=>{if(finished)setCelebrating(false);});
    return()=>{celebration.stop();joy.setValue(0);setCelebrating(false);};
  },[active,reduceMotion,foreground,focused,joy]);
  useEffect(()=>{
    const animation=Animated.spring(touch,{toValue:pressed && !reduceMotion ? .84 : 1,speed:28,bounciness:14,useNativeDriver:true,isInteraction:false});
    animation.start();return()=>animation.stop();
  },[pressed,reduceMotion,touch]);
  const inputRange=[0,.1,.2,.32,.4,.49,.6,.68,.78,.88,1];
  const interpolate=(outputRange:number[])=>progress.interpolate({inputRange,outputRange});
  return <Animated.View pointerEvents="none" style={{transform:[
    {scale:touch},
    {translateY:joy.interpolate({inputRange:[0,.12,.34,.49,.62,.8,1],outputRange:[0,3,-18,0,2,-9,0]})},
    {rotate:joy.interpolate({inputRange:[0,.12,.34,.49,.62,.8,1],outputRange:['0deg','-8deg','-12deg','10deg','-6deg','6deg','0deg']})},
    {scaleX:joy.interpolate({inputRange:[0,.12,.34,.49,.62,.8,1],outputRange:[1,1.15,.94,1.12,1.1,.96,1]})},
    {scaleY:joy.interpolate({inputRange:[0,.12,.34,.49,.62,.8,1],outputRange:[1,.82,1.16,.9,.88,1.08,1]})},
  ]}}>
    <Animated.View style={{opacity:active?1:.7,transform:[
      {translateY:interpolate([0,2,-10,-1,2,-6,0,0,0,0,0])},
      {rotate:progress.interpolate({inputRange,outputRange:['0deg','-8deg','-15deg','11deg','-7deg','10deg','-8deg','6deg','-4deg','2deg','0deg']})},
      {scaleX:interpolate([1,1.16,.92,1.08,1.12,.95,1.06,1,1,1,1])},
      {scaleY:interpolate([1,.8,1.16,.94,.85,1.1,.96,1,1,1,1])},
    ]}}><ChatIcon size={32} color={active?'#FF4199':'#AAAAAA'}/></Animated.View>
  </Animated.View>;
}
