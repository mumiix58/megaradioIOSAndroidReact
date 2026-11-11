import React,{useState} from 'react';
import {Modal,View,Text,Pressable,StyleSheet,useWindowDimensions,Platform} from 'react-native';
import {BlurView} from 'expo-blur';
import {Image} from 'expo-image';
import Svg,{Path} from 'react-native-svg';
import {useTranslation} from 'react-i18next';
import {AvatarWithFallback} from './AvatarWithFallback';
import type {ContextMenuAnchor} from './chat/ChatContextMenu';

/** Spotlight guidance: the real avatar stays actionable above the blurred page. */
export function ProfilePhotoCoach({anchor,privateProfile,avatarUri,onUpload,onClose}:{anchor:ContextMenuAnchor;privateProfile:boolean;hasPhoto:boolean;avatarUri?:string|null;onUpload:()=>void;onClose:()=>void}){
 const {t}=useTranslation(),window=useWindowDimensions();
 const [openingLibrary,setOpeningLibrary]=useState(false);
 // iOS must finish dismissing this presentation before showing its photo picker.
 const upload=()=>{if(Platform.OS==='ios')setOpeningLibrary(true);else onUpload();};
 const focusInset=4;
 const width=Math.min(304,window.width-32),left=Math.max(16,Math.min(window.width-width-16,anchor.x));
 const top=Math.min(anchor.y+anchor.height+64,window.height-170);
 // Point toward the edit badge, but stop 12px before the spotlight's outer edge.
 const centerX=anchor.x+anchor.width/2,centerY=anchor.y+anchor.height/2;
 const directionX=anchor.width/2+3,directionY=anchor.height/2-1;
 const directionLength=Math.hypot(directionX,directionY),stopRadius=anchor.width/2+focusInset+12;
 const targetX=centerX+directionX/directionLength*stopRadius,targetY=centerY+directionY/directionLength*stopRadius;
 const fromX=left+width*.46,fromY=top-10;
 // Align both arrowhead wings to the curve's final tangent, rather than fixed screen angles.
 const tangentLength=Math.hypot(46,40),backX=46/tangentLength,backY=40/tangentLength;
 const headX=targetX+backX*10,headY=targetY+backY*10;
 const head=`M ${headX-backY*4} ${headY+backX*4} L ${targetX} ${targetY} L ${headX+backY*4} ${headY-backX*4}`;
 return <Modal transparent visible={!openingLibrary} onDismiss={()=>{if(openingLibrary)onUpload();}} animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
  <View style={s.overlay} testID="profile-photo-coach" accessibilityViewIsModal>
   <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill}/>
   <Pressable style={[StyleSheet.absoluteFill,s.shade]} onPress={onClose} accessible={false} focusable={false} tabIndex={-1}/>
   <Pressable testID="profile-photo-coach-close" accessibilityRole="button" accessibilityLabel={t('close','Close')} onPress={onClose} style={[s.close,{top:Math.max(16,anchor.y-4)}]}><Image source={require('../../assets/images/share/close.svg')} style={{width:30,height:30}}/></Pressable>
   <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <Svg testID="profile-coach-arrow" width={window.width} height={window.height}>
     <Path d={`M ${fromX} ${fromY} C ${fromX+8} ${fromY-38}, ${targetX+46} ${targetY+40}, ${targetX} ${targetY}`} stroke="#F7F8FC" strokeOpacity={.8} strokeWidth={2} strokeLinecap="round" fill="none"/>
     <Path d={head} stroke="#F7F8FC" strokeOpacity={.8} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </Svg>
   </View>
   <Pressable testID="profile-coach-avatar" onPress={upload} accessibilityRole="button" accessibilityLabel={t('profile_coach_action','Choose a photo')} style={[s.focus,{left:anchor.x-focusInset,top:anchor.y-focusInset,width:anchor.width+focusInset*2,height:anchor.height+focusInset*2,borderRadius:anchor.width/2+focusInset}]}>
    <View pointerEvents="none"><AvatarWithFallback uri={avatarUri} size={anchor.width}/><View style={s.edit}><Image source={require('../../assets/images/profile/edit.svg')} style={{width:14,height:14}}/></View></View>
   </Pressable>
   <Pressable testID="profile-coach-upload" accessibilityRole="button" accessibilityLabel={t('profile_coach_action','Choose a photo')} onPress={upload} style={[s.card,{left,top,width}]}>
    <Text accessibilityRole="header" style={s.title}>{t('profile_coach_title','Start with a photo.')}</Text>
    <Text style={s.body}>{t(privateProfile?'profile_coach_body_private':'profile_coach_body_public')}</Text>
   </Pressable>
  </View>
 </Modal>;
}
const s=StyleSheet.create({overlay:{flex:1},shade:{backgroundColor:'rgba(0,0,0,.24)'},close:{position:'absolute',right:18,width:40,height:40,alignItems:'center',justifyContent:'center'},focus:{position:'absolute',alignItems:'center',justifyContent:'center',borderWidth:1.25,borderColor:'#FF4199',backgroundColor:'#1B1C1E',shadowColor:'#FF4199',shadowOpacity:.1,shadowRadius:6,elevation:10},edit:{position:'absolute',right:-2,bottom:-4,width:14,height:14,alignItems:'center',justifyContent:'center'},card:{position:'absolute',paddingHorizontal:15,paddingVertical:13,backgroundColor:'rgba(22,23,26,.96)',borderWidth:1,borderColor:'#FFFFFF20',borderRadius:6,shadowColor:'#000',shadowOpacity:.2,shadowRadius:12,elevation:12},title:{fontFamily:'Ubuntu-Medium',fontSize:15,lineHeight:20,color:'#F7F8FC',marginBottom:5},body:{fontFamily:'Ubuntu-Regular',fontSize:12,lineHeight:18,color:'#C6C6CF'}});
