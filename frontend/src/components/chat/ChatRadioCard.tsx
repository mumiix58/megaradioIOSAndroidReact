import { MegaLoadingIndicator as ActivityIndicator } from '../MegaLoadingIndicator';
import {useChatRadioPlayback} from '../../hooks/useChatRadioPlayback';
import React,{useEffect,useState,useRef} from 'react';
import {View,Text,TouchableOpacity,StyleSheet} from 'react-native';
import {Image} from 'expo-image';
import {useFavoritesStore} from '../../store/favoritesStore';
import {LinearGradient} from 'expo-linear-gradient';
import {useTranslation} from 'react-i18next';
import {useLogoAccent} from '../../hooks/useLogoAccent';
import {stationService} from '../../services/stationService';
import {getStationLogoUrl} from '../../utils/stationLogoHelper';
import type {RadioGift} from '../../utils/chatRadio';
import {ImageWithFallback} from '../ImageWithFallback';
import {MegaMarkIcon} from '../BrandIcons';
import {ChatLiveBadge} from './ChatLiveBadge';
export function ChatRadioCard({gift,messageId,partnerId,preview,owner,peerName,peerExpiresAt,staged=false,onRemove,standalone=false,groupId,presenceEnabled=true}:{gift:RadioGift;messageId:string;partnerId:string;preview:boolean;owner:string;peerName:string;peerExpiresAt?:number;staged?:boolean;onRemove?:()=>void;standalone?:boolean;groupId?:string;presenceEnabled?:boolean}){
 const {t}=useTranslation(),[error,setError]=useState(false),[now,setNow]=useState(Date.now());
 const {playing,busy,error:playError,play}=useChatRadioPlayback({gift,messageId,partnerId,preview,owner,groupId,staged,standalone,presenceEnabled});
 const favorite=useFavoritesStore(s=>s.favorites.some(station=>station._id===gift.stationId)),[favoriting,setFavoriting]=useState(false);
 const toggleFavorite=async()=>{if(favoriting)return;setFavoriting(true);try{const store=useFavoritesStore.getState();if(store.isFavorite(gift.stationId)){await store.removeFavorite(gift.stationId);return;}const station=await stationService.getStation(gift.stationId);if(station&&alive.current&&currentOwner.current===owner)await store.addFavorite(station);else if(alive.current)setError(true);}catch{if(alive.current)setError(true);}finally{if(alive.current)setFavoriting(false);}};
 const alive=useRef(true),currentOwner=useRef(owner);currentOwner.current=owner;useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{setNow(Date.now());if(!peerExpiresAt)return;const timer=setTimeout(()=>setNow(Date.now()),Math.max(0,peerExpiresAt-Date.now()+20));return()=>clearTimeout(timer);},[peerExpiresAt]);
 const live=!staged&&(playing||!!peerExpiresAt&&peerExpiresAt>now);
 const logo=getStationLogoUrl({_id:gift.stationId,name:gift.name,url:'',favicon:gift.logo});
 const accent=useLogoAccent(logo);
 return <View style={s.card} testID={`chat-radio-card-${messageId}`}><View style={s.heading}><MegaMarkIcon color="#FFFFFF"/><Text style={s.invite}>{staged?t('chat_radio_choose'):gift.intent==='custom'?gift.caption:t(gift.intent==='together'?'chat_radio_together':'chat_radio_gift')}</Text>{!staged&&<ChatLiveBadge active={live} label={playing?t('chat_radio_you_listen'):t('chat_radio_peer_listens',{name:peerName})}/>}{onRemove&&<TouchableOpacity testID="chat-radio-remove" style={s.remove} accessibilityRole="button" accessibilityLabel={t('clear')} onPress={onRemove}><Image source={require('../../../assets/images/share/close.svg')} style={{width:40,height:40}} contentFit="contain"/></TouchableOpacity>}</View><View style={s.station}>{accent&&<LinearGradient testID={`chat-radio-gradient-${messageId}`} pointerEvents="none" colors={[`${accent}30`,`${accent}10`,`${accent}00`]} locations={[0,.26,.62]} start={{x:0,y:.5}} end={{x:1,y:.5}} style={StyleSheet.absoluteFill}/>}<ImageWithFallback uri={logo} style={s.logo} contentFit="cover"/><View style={s.details}><Text style={s.name} numberOfLines={1}>{gift.name}</Text><Text style={s.country} numberOfLines={1}>{gift.genre||gift.country}</Text></View><View style={s.actions}>{!staged&&<TouchableOpacity testID={`chat-radio-favorite-${messageId}`} style={s.favorite} disabled={favoriting} accessibilityRole="button" accessibilityLabel={t(favorite?'remove_from_favorites':'add_to_favorites')} accessibilityState={{selected:favorite,busy:favoriting}} onPress={toggleFavorite}>{favoriting?<ActivityIndicator size="small" color="#FF4199"/>:<Image source={favorite?require('../../../assets/images/mini-player/heart-filled.svg'):require('../../../assets/images/player/heart.svg')} style={{width:24,height:24}} tintColor={favorite?'#FF4199':'#FFFFFF'} contentFit="contain"/>}</TouchableOpacity>}<TouchableOpacity testID={`chat-radio-play-${messageId}`} style={s.play} disabled={busy} accessibilityRole="button" accessibilityLabel={`${gift.name} · ${t(playing?'chat_radio_pause':'chat_radio_listen')}`} onPress={play}>{busy?<ActivityIndicator color="#FFF"/>:<Image source={playing?require('../../../assets/images/mini-player/pause.svg'):require('../../../assets/images/mini-player/play.svg')} style={{width:24,height:24}} contentFit="contain"/>}</TouchableOpacity></View></View>{!staged&&gift.intent!=='custom'&&!!gift.caption&&<Text style={s.caption}>{gift.caption}</Text>}{(error||playError)&&<Text style={s.error}>{t('chat_radio_unavailable')}</Text>}</View>;
}
const s=StyleSheet.create({
 card:{width:'100%'},
 remove:{width:44,height:44,alignItems:'center',justifyContent:'center'},
 heading:{flexDirection:'row',alignItems:'center',gap:7,paddingBottom:9,paddingHorizontal:4},
 invite:{fontFamily:'Ubuntu-Medium',fontSize:11,color:'#D8CDD8',flex:1},
 station:{flexDirection:'row',alignItems:'center',gap:12,minHeight:88,paddingHorizontal:14,backgroundColor:'#27292D',overflow:'hidden',borderRadius:12},
 logo:{width:56,height:56,borderRadius:8},details:{flex:1,minWidth:0},
 name:{fontFamily:'Ubuntu-Medium',fontSize:15,lineHeight:20,color:'#FFF'},
 country:{fontFamily:'Ubuntu-Regular',fontSize:12,color:'#B8B7BE',marginTop:4},
 actions:{flexDirection:'row',alignItems:'center',gap:8,flexShrink:0},
 favorite:{width:40,height:40,borderRadius:20,backgroundColor:'#000000',alignItems:'center',justifyContent:'center'},
 play:{width:40,height:40,borderRadius:20,backgroundColor:'#000000',alignItems:'center',justifyContent:'center'},
 caption:{fontFamily:'Ubuntu-Regular',fontSize:13,lineHeight:20,color:'#ECE8EF',marginTop:9,paddingHorizontal:4},
 error:{color:'#FFD0DF',fontFamily:'Ubuntu-Regular',fontSize:11,marginTop:8}
});
