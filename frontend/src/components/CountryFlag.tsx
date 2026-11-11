import React,{useState} from 'react';
import {View,Text} from 'react-native';
import {Image} from 'expo-image';
import {countryFlagUrl,countryFlagEmoji} from '../utils/countryFlag';

/** One crisp circular flag treatment for the country picker and catalog headers. */
export function CountryFlag({code,size=40,testID}:{code?:string|null;size?:number;testID?:string}){
 const uri=countryFlagUrl(code);
 const [failedUri,setFailedUri]=useState<string|null>(null);
 return <View testID={testID} accessible={false} style={{width:size,height:size,borderRadius:size/2,overflow:'hidden',backgroundColor:'#353535',alignItems:'center',justifyContent:'center',flexShrink:0}}>
  {uri&&failedUri!==uri?<Image source={{uri}} recyclingKey={uri} cachePolicy="memory-disk" contentFit="cover" transition={0} onError={()=>setFailedUri(uri)} style={{width:size,height:size}}/>:<Text style={{fontSize:size*.875}}>{countryFlagEmoji(code)}</Text>}
 </View>;
}
