import React, {useEffect} from 'react';
import {View} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import Animated, {cancelAnimation, Easing, SharedValue, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming} from 'react-native-reanimated';
import {elasticFrequencyCursor} from '../utils/elasticFrequency';

const AnimatedPath = Animated.createAnimatedComponent(Path);

function FrequencyTick({index, unit, pull, pulse, playing, wave}: {index:number;unit:number;pull:SharedValue<number>;pulse:SharedValue<number>;playing:boolean;wave:boolean}) {
 const style=useAnimatedStyle(()=>{
  const x=(index-24)/24, bend=wave?0:-5*unit;
  const cursor=elasticFrequencyCursor(pull.value,unit),near=wave?0:Math.max(0,1-Math.abs((index-24)*6*unit-cursor.x)/(18*unit))*Math.min(1,Math.abs(pull.value)/(10*unit));
  const envelope=1-Math.abs(x), beat=(Math.sin(index*1.9+pulse.value*2)+1)/2;
  const height=playing?(4+envelope*(8+beat*23))*unit:(index%5===0?16:index%2===0?10:6)*unit;
  return {height,top:33*unit-height/2,opacity:.12+envelope*(playing?.8:.48)+near*.3,backgroundColor:playing||near>.2?'#FF4199':'#D8D7DF',transform:[{translateY:bend*(1-x*x)},{rotate:`${-x*bend*.65}deg`}]};
 });
 return <Animated.View style={[{position:'absolute',left:(8+index*6)*unit,top:25*unit,width:1.5*unit,borderRadius:unit},style]}/>;
}

/** A UI-thread frequency filament. The same gesture still drives the CarPlay tuner. */
export function ElasticFrequency({unit,pull,playing=false,wave=false,showArrows=true}:{unit:number;pull:SharedValue<number>;playing?:boolean;wave?:boolean;showArrows?:boolean}) {
 const pulse=useSharedValue(0),reduced=useReducedMotion();
 useEffect(()=>{cancelAnimation(pulse);pulse.value=0;if(playing&&!reduced)pulse.value=withRepeat(withTiming(Math.PI*2,{duration:1900,easing:Easing.linear}),-1,false);return()=>cancelAnimation(pulse);},[playing,reduced,pulse]);
 const line=useAnimatedProps(()=>{
  const bend=wave?0:-10;
  return {d:`M 8 33 Q 152 ${33+bend} 296 33`,opacity:wave?0:.12+Math.min(.53,Math.abs(pull.value)/100)};
 });
 const marker=useAnimatedStyle(()=>{const cursor=elasticFrequencyCursor(pull.value,unit);return {opacity:wave?0:.95,transform:[{translateX:wave?0:cursor.x},{translateY:wave?0:cursor.y}]};});
 return <View pointerEvents="none" style={{width:304*unit,height:58*unit}}>
  <Svg width={304*unit} height={58*unit} viewBox="0 0 304 58"><AnimatedPath animatedProps={line} stroke="#FF4199" strokeWidth={1.5} fill="none"/></Svg>
  {Array.from({length:49},(_,index)=><FrequencyTick key={index} index={index} unit={unit} pull={pull} pulse={pulse} playing={playing} wave={wave}/>)}
  {!wave&&showArrows&&<>{[false,true].map(right=><View key={String(right)} style={{position:'absolute',top:17*unit,...(right?{right:0}:{left:0}),width:30*unit,height:30*unit,borderRadius:15*unit,backgroundColor:'#FF41991C',alignItems:'center',justifyContent:'center',transform:[{rotate:right?'180deg':'0deg'}]}}><Svg width={17*unit} height={17*unit} viewBox="0 0 24 24"><Path d="M 13 6 L 7 12 L 13 18 M 20 6 L 14 12 L 20 18" stroke="#E2C6D6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/></Svg></View>)}</>}
  <Animated.View testID="frequency-cursor" style={[{position:'absolute',left:151*unit,top:17*unit,width:2*unit,height:31*unit,borderRadius:unit,backgroundColor:'#FF4199'},marker]}/>
 </View>;
}
