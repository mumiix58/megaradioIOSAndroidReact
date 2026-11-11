import {Skeleton} from './Skeleton';
import React from 'react';
import {View} from 'react-native';
import {Image} from 'expo-image';
import {ImageWithFallback} from './ImageWithFallback';
import {getStationLogoUrl} from '../utils/stationLogoHelper';
import type {Station} from '../types';

/** One Higgsfield artwork plate for chat discovery and CarPlay; scale only its local slot. */
export function DiscoveryArtwork({station,unit,testID}:{station?:Station;unit:number;testID:string}){
 return <>
  <Image source={require('../../assets/images/chat/discovery-card-material.png')} contentFit="contain" accessible={false} pointerEvents="none"
   style={{position:'absolute',width:250*unit,height:250*unit,top:-31*unit,left:-31*unit}}/>
  <View style={{position:'absolute',top:4*unit,left:4*unit,width:180*unit,height:180*unit,borderRadius:13*unit,overflow:'hidden',backgroundColor:'#1D1D21'}}>
   {station?<ImageWithFallback testID={testID} uri={getStationLogoUrl(station,'large')} style={{width:'100%',height:'100%'}} contentFit="contain"/>:<Skeleton width="100%" height={180*unit} borderRadius={13*unit}/>}
  </View>
 </>;
}
