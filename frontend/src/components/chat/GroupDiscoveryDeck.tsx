import React from 'react';
import {View} from 'react-native';
import Animated,{SharedValue,useAnimatedStyle} from 'react-native-reanimated';
import {LogoShadow} from '../LogoShadow';
import {useLogoAccent} from '../../hooks/useLogoAccent';
import {DiscoveryArtwork} from '../DiscoveryArtwork';
import {getStationLogoUrl} from '../../utils/stationLogoHelper';
import {carouselDelta,carouselGeometry} from '../../utils/carCarousel';
import {CountryFlag} from '../CountryFlag';
import type {Station} from '../../types';

function DiscoveryCard({station,slot,count,unit,position}:{station:Station;slot:number;count:number;unit:number;position:SharedValue<number>}){
 const style=useAnimatedStyle(()=>{
  const delta=carouselDelta(slot,position.value,count),card=carouselGeometry(delta),scale=card.size/150;
  return {zIndex:card.depth,opacity:card.opacity*(1-Math.min(Math.abs(delta),2)*.18),transform:[{translateX:(card.center-188)*unit},{scale}]};
 });
 const flagStyle=useAnimatedStyle(()=>({opacity:Math.max(0,1-Math.abs(carouselDelta(slot,position.value,count))/1.25)}));
 const code=(station.countrycode||station.countryCode||'').trim().toUpperCase();
 return <Animated.View testID={`group-discovery-slot-${slot}`} pointerEvents="none" style={[{position:'absolute',left:93.5*unit,top:24*unit,width:188*unit,height:188*unit,borderRadius:15*unit,overflow:'visible'},style]}>
  <DiscoveryArtwork station={station} unit={unit} testID={`group-discovery-logo-${slot}`}/>
  {/^[A-Z]{2}$/.test(code)&&<Animated.View testID={`group-discovery-country-flag-${slot}`} pointerEvents="none" style={[{position:'absolute',right:-14*unit,bottom:-14*unit},flagStyle]}><CountryFlag code={code} size={28*unit}/></Animated.View>}
 </Animated.View>;
}
export function GroupDiscoveryDeck({deck,unit,position,slotsCount,station,active}:{deck:Station[];unit:number;position:SharedValue<number>;slotsCount:number;station:Station;active:boolean}){
 const accent=useLogoAccent(active?getStationLogoUrl(station,'large'):null),artScale=188/150;
 return <View pointerEvents="none" style={{width:375*unit,height:242*unit}}>{accent&&<LogoShadow color={accent} scale={unit*artScale} centerX={187.5/artScale} centerY={118/artScale} testID="group-discovery-logo-glow"/>}<View style={{width:'100%',height:'100%',overflow:'hidden'}}>{Array.from({length:slotsCount},(_,slot)=><DiscoveryCard key={slot} station={deck[slot%deck.length]} slot={slot} count={slotsCount} unit={unit} position={position}/>)}</View></View>;
}
