import React,{useEffect} from 'react';
import {View,StyleSheet} from 'react-native';
import {Image} from 'expo-image';
import Animated,{useSharedValue,useAnimatedStyle,useReducedMotion,withRepeat,withTiming,withSequence,cancelAnimation} from 'react-native-reanimated';
import {LinearGradient} from 'expo-linear-gradient';

/** Higgsfield world material, with live UI accents rather than rasterized controls. */
export function PrivateDiscoveryHero({height}:{height:number}){
 const drift=useSharedValue(0),reduced=useReducedMotion();
 useEffect(()=>{drift.value=0;if(!reduced)drift.value=withRepeat(withSequence(withTiming(-4,{duration:3200}),withTiming(0,{duration:3200})),-1);return()=>cancelAnimation(drift);},[reduced,drift]);
 const floating=useAnimatedStyle(()=>({transform:[{translateY:drift.value}]}));
 return <View testID="chat-discovery-world" pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{height,alignSelf:'stretch',marginHorizontal:-22}}>
  <Animated.View style={[StyleSheet.absoluteFill,floating]}>
   <Image source={require('../../../assets/images/chat/discovery-world-higgsfield.png')} contentFit="contain" style={StyleSheet.absoluteFill}/>
   {[{source:require('../../../assets/images/chat/discovery-flag-tr.png'),code:'tr',left:'15%',top:'24%',rotate:'-10deg'},{source:require('../../../assets/images/chat/discovery-flag-jp.png'),code:'jp',left:'77%',top:'38%',rotate:'10deg'},{source:require('../../../assets/images/chat/discovery-flag-br.png'),code:'br',left:'19%',top:'67%',rotate:'-6deg'}].map(flag=><View key={flag.code} style={[s.flag,{left:flag.left as `${number}%`,top:flag.top as `${number}%`,transform:[{rotate:flag.rotate}]}]}><Image source={flag.source} contentFit="cover" style={{width:25,height:25,borderRadius:13}}/><View style={s.wave}>{[4,9,6,12,7,4].map((h,i)=><View key={i} style={{width:2,height:h,backgroundColor:'#FF94C6',borderRadius:1,opacity:.55+i*.06}}/>)}</View></View>)}
  </Animated.View>
  <LinearGradient colors={['#1B1B1B00','#1B1B1B']} style={{position:'absolute',bottom:-1,left:0,right:0,height:30}}/>
 </View>;
}
const s=StyleSheet.create({flag:{position:'absolute',width:53,height:54,alignItems:'center',justifyContent:'center',gap:4,borderRadius:8,borderWidth:1,borderColor:'#FFFFFF25',backgroundColor:'#27252BE8'},wave:{flexDirection:'row',alignItems:'center',gap:2,height:12}});
