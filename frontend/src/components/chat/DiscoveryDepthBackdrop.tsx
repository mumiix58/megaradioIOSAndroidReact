import React from 'react';
import {Platform,StyleSheet,View,useWindowDimensions} from 'react-native';
import {BlurView} from '../common/BlurView';

/** A shallow peripheral blur and feathered oval focal planes, rather than a flat sheet. */
export function DiscoveryDepthBackdrop(){
 const {width,height}=useWindowDimensions();
 return <View testID="group-discovery-depth" pointerEvents="none" style={StyleSheet.absoluteFill}>
  <BlurView style={StyleSheet.absoluteFillObject} intensity={30} tint="dark" blurColor="rgba(12,12,16,.32)" blurAmount={8}/>
  <View style={StyleSheet.absoluteFill}>
   {Platform.OS==='web'?<>
    <BlurView style={{...StyleSheet.absoluteFillObject,maskImage:'radial-gradient(ellipse 70% 56% at 50% 48%, black 0%, rgba(0,0,0,.85) 34%, transparent 100%)',WebkitMaskImage:'radial-gradient(ellipse 70% 56% at 50% 48%, black 0%, rgba(0,0,0,.85) 34%, transparent 100%)'} as any} intensity={44} tint="dark" blurAmount={12} blurColor="rgba(27,27,32,.18)"/>
    <BlurView style={{...StyleSheet.absoluteFillObject,maskImage:'radial-gradient(ellipse 53% 43% at 50% 47%, black 0%, rgba(0,0,0,.92) 28%, transparent 100%)',WebkitMaskImage:'radial-gradient(ellipse 53% 43% at 50% 47%, black 0%, rgba(0,0,0,.92) 28%, transparent 100%)'} as any} intensity={78} tint="dark" blurAmount={26} blurColor="rgba(26,25,30,.32)"/>
   </>:<>{[0,1,2].map(i=>{const w=width*(1.7-i*.2),h=Math.min(height*(.92-i*.1),820-i*80);return <View key={i} style={{position:'absolute',width:w,height:h,left:(width-w)/2,top:(height-h)/2-12,borderRadius:Math.max(w,h)/2,overflow:'hidden',opacity:.18+i*.12}}><BlurView style={StyleSheet.absoluteFillObject} intensity={38+i*18} tint="dark" blurColor="rgba(26,25,30,.2)" blurAmount={12+i*7}/></View>;})}</>}
  </View>
 </View>;
}
