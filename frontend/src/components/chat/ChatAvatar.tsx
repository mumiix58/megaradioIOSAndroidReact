import React from 'react';
import { View } from 'react-native';
import {Image} from 'expo-image';
import { AvatarWithFallback } from '../AvatarWithFallback';
import { profileAvatar } from '../../utils/publicProfileView';
import type { ChatUser } from '../../services/chatService';
export function ChatAvatar({person,size=46,online=false}:{person?:ChatUser|null;size?:number;online?:boolean}){
 const portraits:Record<string,any>={'demo-0':require('../../../assets/images/chat/people/deniz.jpg'),'demo-1':require('../../../assets/images/chat/people/ece.jpg'),'demo-2':require('../../../assets/images/chat/people/mert.jpg'),'demo-3':require('../../../assets/images/chat/people/lina.jpg'),'demo-4':require('../../../assets/images/chat/people/arda.jpg'),'demo-5':require('../../../assets/images/chat/people/selin.jpg')};
 const photo=person?portraits[person._id]:undefined;
 return <View style={{width:size,height:size}}>{photo?<Image source={photo} style={{width:size,height:size,borderRadius:size/2}} contentFit="cover"/>:<AvatarWithFallback uri={profileAvatar(person)} size={size} figmaFallback/>}{online&&<View style={{position:'absolute',right:0,bottom:0,width:12,height:12,borderRadius:6,backgroundColor:'#42CA91',borderWidth:2,borderColor:'#1B1C1E'}}/>}</View>;
}
