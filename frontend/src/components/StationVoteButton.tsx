import { MegaLoadingIndicator as ActivityIndicator } from './MegaLoadingIndicator';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, TouchableOpacity, Text } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Stop, Circle } from 'react-native-svg';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { stationService } from '../services/stationService';
import { useAuthStore } from '../store/authStore';
import { formatVoteCount } from '../utils/voteCount';

// Same 1.15/1.1 success bounce and 600ms radial acknowledgement as web VoteButton.
export const StationVoteButton = ({ stationId, onVoted, disabled = false, preview = false, countLabel, fullCount, onNotice }: {
  stationId: string; onVoted: (votes:number)=>void; disabled?:boolean; preview?:boolean;
  countLabel?:string; fullCount?:number; onNotice?:(notice:{error:boolean;message:string})=>void;
}) => {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const owner = useAuthStore(state=>state.isAuthenticated ? state.user?._id : null);
  const key = ['station-vote',stationId,owner];
  const {data} = useQuery({queryKey:key, queryFn:()=>stationService.voteState(stationId), enabled:!!owner && !preview, retry:false, staleTime:30000});
  const displayedVotes=data?.votes ?? fullCount;
  const displayedCount=displayedVotes===undefined?countLabel:formatVoteCount(displayedVotes,i18n.language);
  const [pending,setPending]=useState(false);
  const [reduceMotion,setReduceMotion]=useState(false);
  const active=useRef({stationId,owner}); active.current={stationId,owner};
  const inFlight=useRef(false);
  const bounce=useRef(new Animated.Value(0)).current;
  const pulse=useRef(new Animated.Value(1)).current;
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{ bounce.stopAnimation();pulse.stopAnimation();bounce.setValue(0);pulse.setValue(1); },[stationId,owner,bounce,pulse]);
  useEffect(()=>{
    void AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(mounted.current)setReduceMotion(value);});
    const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduceMotion);
    return()=>{sub.remove();bounce.stopAnimation();pulse.stopAnimation();};
  },[bounce,pulse]);
  const notify=(message:string,error=false)=>onNotice?.({message,error});
  const vote=async()=>{
    if(disabled||inFlight.current)return;
    if(preview){notify(t('vote_preview'));return;}
    if(!owner){notify(t('vote_login_required'));return;}
    if(data?.hasVoted){notify(t('vote_already_cast'));return;}
    inFlight.current=true;setPending(true);
    const id=stationId, actor=owner;
    try {
      const result=await stationService.voteStation(id);
      if(!mounted.current||active.current.stationId!==id||active.current.owner!==actor)return;
      client.setQueryData(key,{votes:result.votes,hasVoted:true});
      onVoted(result.votes);
      if(result.alreadyVoted){notify(t('vote_already_cast'));return;}
      if(!reduceMotion){
        bounce.setValue(0);pulse.setValue(0);
        Animated.parallel([
          Animated.sequence([
            Animated.timing(bounce,{toValue:1,duration:300,easing:Easing.bezier(0.34,1.56,0.64,1),useNativeDriver:true}),
            Animated.delay(200),
            Animated.timing(bounce,{toValue:0,duration:180,easing:Easing.out(Easing.cubic),useNativeDriver:true}),
          ]),
          Animated.timing(pulse,{toValue:1,duration:600,easing:Easing.out(Easing.quad),useNativeDriver:true}),
        ]).start();
      }
    } catch(error:any) {
      if(mounted.current&&active.current.stationId===id&&active.current.owner===actor)
        notify(error?.response?.status===401?t('vote_login_required'):t('vote_failed_message'),true);
    } finally {inFlight.current=false;if(mounted.current)setPending(false);}
  };
  return <TouchableOpacity onPress={vote} disabled={disabled||pending} activeOpacity={0.8} style={styles.touch}
    accessibilityRole="button" accessibilityLabel={`${t('vote_station')}${displayedVotes===undefined?'':`, ${new Intl.NumberFormat(i18n.language).format(displayedVotes)}`}`}
    accessibilityState={{disabled:disabled||pending,busy:pending,selected:!!data?.hasVoted}} testID="player-vote-button">
    <Animated.View style={[styles.button,{transform:[{scale:bounce.interpolate({inputRange:[0,1],outputRange:[1,1.15]})}]}]}>
      <Animated.View pointerEvents="none" style={[{position:'absolute',width:40,height:40,left:-4,top:0},{opacity:pulse.interpolate({inputRange:[0,1],outputRange:[1,0]}),transform:[{scale:pulse.interpolate({inputRange:[0,1],outputRange:[0.8,1.5]})}]}]}>
        <Svg width={40} height={40}><Defs><RadialGradient id="votePulse"><Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.3}/><Stop offset="0.7" stopColor="#FFFFFF" stopOpacity={0}/></RadialGradient></Defs><Circle cx={20} cy={20} r={20} fill="url(#votePulse)"/></Svg>
      </Animated.View>
      {pending?<ActivityIndicator size="small" color="#FF4199"/>:<Animated.View style={{transform:[{scale:bounce.interpolate({inputRange:[0,1],outputRange:[1,1.1]})}]}}><StationVoteIcon size={20} color="#FF4199"/></Animated.View>}
    </Animated.View>
    {displayedCount!==undefined&&<Text style={styles.count}>{displayedCount}</Text>}
  </TouchableOpacity>;
};
const styles=StyleSheet.create({
  touch:{minHeight:44,minWidth:44,flexDirection:'row',alignItems:'center',justifyContent:'center',paddingRight:6},
  button:{width:32,height:40,alignItems:'center',justifyContent:'center'},
  count:{fontFamily:'Ubuntu-Medium',fontSize:16,lineHeight:22,color:'#F6F6F8',fontVariant:['tabular-nums']},
});

export function StationVoteIcon({ size = 24, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M14 9V4C14 2.89543 13.1046 2 12 2C11.4477 2 11 2.44772 11 3V6.5C11 7.5 10.5 8.5 9.5 9.5L8 11H4C2.89543 11 2 11.8954 2 13V20C2 21.1046 2.89543 22 4 22H17C18.6569 22 20 20.6569 20 19V14C20 11.7909 18.2091 10 16 10H14V9Z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M8 11V22" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>);
}
