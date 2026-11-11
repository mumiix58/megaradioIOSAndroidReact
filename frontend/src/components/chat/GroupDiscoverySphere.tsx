import React,{useEffect} from 'react';
import {View,StyleSheet} from 'react-native';
import {Image} from 'expo-image';
import Animated,{cancelAnimation,Easing,SharedValue,useAnimatedStyle,useReducedMotion,useSharedValue,withRepeat,withSequence,withTiming} from 'react-native-reanimated';
import {discoveryPullMotion} from '../../utils/discoveryPullMotion';
import {MegaMarkIcon} from '../BrandIcons';

/** Higgsfield glass material, with the original Mega mark and live tuner-driven motion. */
export function GroupDiscoverySphere({unit,motion,active}:{unit:number;motion:SharedValue<number>;active:boolean}){
 const breath=useSharedValue(0),reduced=useReducedMotion();
 useEffect(()=>{cancelAnimation(breath);if(reduced)breath.value=0;if(active&&!reduced)breath.value=withRepeat(withSequence(withTiming(1,{duration:2400,easing:Easing.inOut(Easing.sin)}),withTiming(0,{duration:2600,easing:Easing.inOut(Easing.sin)})),-1,false);return()=>cancelAnimation(breath);},[active,reduced,breath]);
 const body=useAnimatedStyle(()=>{const pull=discoveryPullMotion(motion.value,unit);return {transform:[{translateX:pull.translateX},{translateY:-breath.value*1.8*unit},{scale:pull.scale+breath.value*.018}]};});
 const waves=useAnimatedStyle(()=>{const pull=discoveryPullMotion(motion.value,unit);return {opacity:.24+breath.value*.05+pull.amount*.045,transform:[{translateX:pull.translateX*.3},{scaleX:1+breath.value*.018+pull.amount*.08},{scaleY:1+breath.value*.012}]};});
 return <View testID="group-discovery-sphere" pointerEvents="none" style={{width:354*unit,height:242*unit,alignItems:'center',justifyContent:'center'}}>
  <Animated.View testID="group-discovery-sphere-waves" style={[StyleSheet.absoluteFill,waves]}><Image testID="group-discovery-resonance-material" source={require('../../../assets/images/chat/discovery-resonance.png')} contentFit="contain" style={{position:'absolute',width:354*unit,height:354*unit,left:0,top:-56*unit}}/></Animated.View>
  <Animated.View testID="group-discovery-sphere-body" style={[{width:208*unit,height:208*unit,alignItems:'center',justifyContent:'center'},body]}>
   <Image testID="group-discovery-glass-material" source={require('../../../assets/images/chat/discovery-glass-orb.png')} contentFit="contain" style={{position:'absolute',width:284*unit,height:284*unit,left:-38*unit,top:-38*unit,opacity:.94}}/>
   <View style={{alignItems:'center',marginTop:2*unit}}><View style={{transform:[{scale:2.1*unit}],height:44*unit,justifyContent:'center'}}><MegaMarkIcon color="#FF4199"/></View><Image testID="group-discovery-wordmark" source={require('../../../assets/images/chat/mega-wordmark-figma.svg')} contentFit="contain" accessibilityLabel="Mega Radio" style={{width:132*unit,height:28*unit,marginTop:8*unit}}/></View>
  </Animated.View>
 </View>;
}
