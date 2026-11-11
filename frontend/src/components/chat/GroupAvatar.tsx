import React,{useState} from 'react';
import {chatImageUrl} from '../../services/chatService';
import {View} from 'react-native';
import {Image} from 'expo-image';
import {MaterialCommunityIcons} from '@expo/vector-icons';
export function GroupAvatar({uri,size=48}:{uri?:string;size?:number}){
 const [failed,setFailed]=useState<string>();
 return <View style={{width:size,height:size,borderRadius:size/2,backgroundColor:'#303236',alignItems:'center',justifyContent:'center',overflow:'hidden',borderWidth:1,borderColor:'#44464B'}}>{uri&&failed!==uri?<Image source={{uri:uri.startsWith('/uploads/')?chatImageUrl(uri)||undefined:uri}} style={{width:size,height:size}} contentFit="cover" onError={()=>setFailed(uri)}/>:<MaterialCommunityIcons name="account-group-outline" size={size*.53} color="#E1E2E6"/>}</View>;
}
