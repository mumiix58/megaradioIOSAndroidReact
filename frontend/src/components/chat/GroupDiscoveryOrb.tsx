import React,{useEffect,useRef,useState} from 'react';
import {Animated,AccessibilityInfo,TouchableOpacity,StyleSheet} from 'react-native';
import {MegaMarkIcon} from '../BrandIcons';
import {useTranslation} from 'react-i18next';
export function GroupDiscoveryOrb({onPress,active,disabled,privateChat=false}:{onPress:()=>void;active:boolean;disabled:boolean;privateChat?:boolean}){
 const {t}=useTranslation(),value=useRef(new Animated.Value(0)).current,[reduced,setReduced]=useState(true);
 useEffect(()=>{let live=true;void AccessibilityInfo.isReduceMotionEnabled().then(v=>{if(live)setReduced(v);});const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduced);return()=>{live=false;sub.remove();};},[]);
 useEffect(()=>{value.setValue(0);if(!active||reduced||disabled)return;const loop=Animated.loop(Animated.sequence([Animated.delay(1400),Animated.timing(value,{toValue:1,duration:1500,useNativeDriver:true,isInteraction:false}),Animated.delay(2600),Animated.timing(value,{toValue:0,duration:0,useNativeDriver:true,isInteraction:false})]));loop.start();return()=>loop.stop();},[active,reduced,disabled,value]);
 return <TouchableOpacity testID={privateChat?"chat-discovery-open":"group-discovery-open"} accessibilityRole="button" accessibilityLabel={t(privateChat?'chat_discovery_open':'group_discovery_open')} disabled={disabled} onPress={onPress} activeOpacity={.8} style={s.touch}><Animated.View style={[s.orb,{opacity:disabled ? .4 : 1,transform:[{translateY:value.interpolate({inputRange:[0,.2,.45,.65,1],outputRange:[0,-4,1,-2,0]})},{rotate:value.interpolate({inputRange:[0,.25,.5,.75,1],outputRange:['0deg','-14deg','12deg','-6deg','0deg']})}]}]}><MegaMarkIcon color="#FFFFFF"/></Animated.View></TouchableOpacity>;
}
const s=StyleSheet.create({touch:{width:48,height:48,alignItems:'center',justifyContent:'center'},orb:{width:36,height:36,borderRadius:18,backgroundColor:'#B51F69',borderWidth:1,borderColor:'#FF4199',alignItems:'center',justifyContent:'center'}});
