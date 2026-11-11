import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {FlatList,Platform,Pressable,StyleSheet,Text,View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {Image} from 'expo-image';
import type {Genre} from '../../types';
const ROW=46;
/** Centered, snapping picker; repeated slots keep the first choices surrounded. */
export function GenreWheel({choices,initialIndex=0,values,onChange}:{choices:Genre[];initialIndex?:number;values:string[];onChange:(index:number)=>void}){
 const count=choices.length,repeat=count>1?5:1,base=count>1?count*2:0;
 const slots=useMemo(()=>Array.from({length:count*repeat},(_,slot)=>({genre:choices[slot%count],slot})),[choices,count,repeat]);
 const list=useRef<FlatList<{genre:Genre;slot:number}>>(null),ready=useRef(false),settle=useRef<ReturnType<typeof setTimeout>|null>(null);
 const [physical,setPhysical]=useState(base+Math.min(initialIndex,count-1));
 const current=useRef(physical);const change=useRef(onChange);change.current=onChange;
 const clear=()=>{if(settle.current)clearTimeout(settle.current);};
 useEffect(()=>()=>clear(),[]);
 const select=useCallback((slot:number,animated=true)=>{
  clear();current.current=slot;setPhysical(slot);change.current(slot%count);
  list.current?.scrollToOffset({offset:slot*ROW,animated});
 },[count]);
 const finish=useCallback(()=>{
  clear();const slot=current.current;
  // Recenter equivalent slots after scrolling, never during a drag.
  const target=count>1&&(slot<count||slot>=count*4)?base+slot%count:slot;
  select(target,target===slot);
 },[base,count,select]);
 return <View style={s.wheel} testID="group-genre-wheel">
  <View pointerEvents="none" testID="group-genre-selection-band" style={s.band}>
   <Image source={require('../../../assets/images/genre-picker/selection-top.svg')} contentFit="fill" style={[s.bandLine,{top:0}]}/>
   <Image source={require('../../../assets/images/genre-picker/selection-bottom.svg')} contentFit="fill" style={[s.bandLine,{bottom:0}]}/>
  </View>
  <FlatList ref={list} data={slots} keyExtractor={item=>String(item.slot)} initialNumToRender={9} maxToRenderPerBatch={7} windowSize={3}
   initialScrollIndex={physical} getItemLayout={(_,index)=>({length:ROW,offset:index*ROW,index})}
   onContentSizeChange={()=>{if(!ready.current){ready.current=true;list.current?.scrollToOffset({offset:current.current*ROW,animated:false});}}}
   showsVerticalScrollIndicator={false} bounces={false} snapToInterval={ROW} decelerationRate="fast" scrollEventThrottle={16}
   keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingVertical:ROW*2}}
   onScrollBeginDrag={clear} onMomentumScrollBegin={clear}
   onScroll={event=>{const slot=Math.max(0,Math.min(slots.length-1,Math.round(event.nativeEvent.contentOffset.y/ROW)));if(slot!==current.current){current.current=slot;setPhysical(slot);change.current(slot%count);}if(Platform.OS==='web'){clear();settle.current=setTimeout(finish,140);}}}
   onScrollEndDrag={()=>{clear();settle.current=setTimeout(finish,180);}} onMomentumScrollEnd={finish}
   renderItem={({item})=>{const distance=Math.abs(item.slot-physical);return <Pressable testID={distance===0?`group-more-genre-${item.genre.slug}`:undefined} accessibilityRole="button" accessibilityLabel={item.genre.name} accessibilityState={{selected:distance===0}} onPress={()=>select(item.slot)} style={s.row}>
    <Text numberOfLines={1} style={[s.label,{fontSize:distance===0?22:distance===1?18:16,color:distance===0?'#FFFFFF':distance===1?'#88888F':'#44444B'}]}>{item.genre.name}{values.includes(item.genre.slug)?' ✓':''}</Text>
   </Pressable>;}}/>
  <LinearGradient pointerEvents="none" colors={['#000000','#00000000']} style={s.topFade}/>
  <LinearGradient pointerEvents="none" colors={['#00000000','#000000']} style={s.bottomFade}/>
 </View>;
}
const s=StyleSheet.create({wheel:{height:ROW*5,overflow:'hidden'},band:{position:'absolute',top:ROW*2,left:0,right:0,height:ROW,backgroundColor:'rgba(255,255,255,0.06)'},bandLine:{position:'absolute',width:'62.933333%',height:1,alignSelf:'center'},row:{height:ROW,alignItems:'center',justifyContent:'center',paddingHorizontal:8},label:{fontFamily:'Ubuntu-Medium',lineHeight:28,textAlign:'center'},topFade:{position:'absolute',top:0,left:0,right:0,height:32},bottomFade:{position:'absolute',bottom:0,left:0,right:0,height:32}});
