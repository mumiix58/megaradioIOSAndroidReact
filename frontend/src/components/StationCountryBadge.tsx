import React,{useEffect,useMemo,useState} from 'react';
import {Platform,Text,TouchableOpacity,View,type StyleProp,type ViewStyle} from 'react-native';
import {useTranslation} from 'react-i18next';
import {CountryFlag} from './CountryFlag';
import type {Station} from '../types';

/** Shared Car Mode / player country interaction, anchored to the artwork. */
export function StationCountryBadge({station,unit=1,disabled=false,showFlag=true,style,testID='station-country'}:{station?:Station|null;unit?:number;disabled?:boolean;showFlag?:boolean;style?:StyleProp<ViewStyle>;testID?:string}){
 const {i18n}=useTranslation(),[open,setOpen]=useState(false);
 const code=(station?.countrycode||station?.countryCode||'').trim().toUpperCase();
 const name=useMemo(()=>{try{return new Intl.DisplayNames([i18n.language||'en'],{type:'region'}).of(code)||station?.country||code;}catch{return station?.country||code;}},[code,station?.country,i18n.language]);
 useEffect(()=>setOpen(false),[station?._id,code,disabled]);
 useEffect(()=>{if(!open)return;const timer=setTimeout(()=>setOpen(false),3200);return()=>clearTimeout(timer);},[open]);
 if(disabled||!/^[A-Z]{2}$/.test(code))return null;
 return <View style={[{position:'absolute',width:44*unit,height:44*unit,zIndex:120},style]} onTouchStart={e=>e.stopPropagation()} {...(Platform.OS==='web'?{onPointerDown:(e:any)=>e.stopPropagation(),onKeyDown:(e:any)=>{if(e.key==='Escape')setOpen(false);}}:{} as any)}>
  <TouchableOpacity testID={`${testID}-button`} accessibilityRole="button" accessibilityLabel={name} accessibilityState={{expanded:open}} activeOpacity={1} onBlur={()=>setOpen(false)} onPress={e=>{e.stopPropagation();setOpen(value=>!value);}} style={{flex:1,alignItems:'center',justifyContent:'center'}}>
   {showFlag&&<CountryFlag code={code} size={28*unit}/>}
  </TouchableOpacity>
  {open&&<View testID={`${testID}-tooltip`} pointerEvents="none" accessible accessibilityLabel={name} accessibilityLiveRegion="polite" {...(Platform.OS==='web'?{role:'tooltip'} as any:{})} style={{position:'absolute',bottom:44*unit,left:-78*unit,width:200*unit,alignItems:'center',zIndex:121}}>
   <View style={{maxWidth:200*unit,paddingHorizontal:12*unit,paddingVertical:8*unit,borderRadius:6*unit,backgroundColor:'#030507'}}><Text style={{fontFamily:'Ubuntu-Medium',fontSize:14*unit,lineHeight:20*unit,color:'#FFFFFF',textAlign:'center'}}>{name}</Text></View>
   <View style={{width:0,height:0,borderLeftWidth:7*unit,borderRightWidth:7*unit,borderTopWidth:9*unit,borderLeftColor:'transparent',borderRightColor:'transparent',borderTopColor:'#030507'}}/>
  </View>}
 </View>;
}
