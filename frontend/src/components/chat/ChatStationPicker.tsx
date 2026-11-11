import {MegaLoadingState} from '../MegaLoadingState';
import { stationService } from '../../services/stationService';
import { rankStationSearch, STATION_SEARCH_VERSION } from '../../utils/stationSearch';
import React,{useEffect,useState} from 'react';
import {View,Text,TextInput,FlatList,TouchableOpacity,StyleSheet,Platform} from 'react-native';
import {Image} from 'expo-image';
import {useQuery} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {useFavoritesStore} from '../../store/favoritesStore';
import api from '../../services/api';
import type {Station} from '../../types';
import {getStationLogoUrl} from '../../utils/stationLogoHelper';
import {ImageWithFallback} from '../ImageWithFallback';
import {MegaMarkIcon} from '../BrandIcons';
import {ChatIcon} from './ChatIcons';
export function ChatStationPicker({onSelect,onClose}:{onSelect:(station:Station)=>void;onClose:()=>void}){
 const {t}=useTranslation(),favorites=useFavoritesStore(s=>s.favorites),[source,setSource]=useState<'favorites'|'catalog'>(favorites.length?'favorites':'catalog'),[input,setInput]=useState(''),[query,setQuery]=useState(''),[searchFocused,setSearchFocused]=useState(false);
 useEffect(()=>{const timer=setTimeout(()=>setQuery(input.trim()),280);return()=>clearTimeout(timer);},[input]);
 const result=useQuery({queryKey:['chat-radio-catalog',STATION_SEARCH_VERSION,query],queryFn:async({signal})=>{if(query)return stationService.searchStations(query,24,signal);const {data}=await api.get('/api/stations',{params:{limit:24,sort:'votes',order:'desc',excludeBroken:true},signal});return (Array.isArray(data)?data:data.stations||data.data||[]) as Station[];},enabled:source==='catalog'&&input.trim()===query,staleTime:60000,retry:false});
 const stations=(source==='favorites'?(input.trim()?rankStationSearch(favorites,input,500):[...favorites].sort((a,b)=>(b.votes||0)-(a.votes||0))):input.trim()===query?result.data||[]:[]).filter(station=>/^[a-f0-9]{24}$/i.test(station._id));
 return <View style={s.panel} testID="chat-radio-picker"><View style={s.heading}><MegaMarkIcon color="#FF64B1"/><Text style={s.title}>{t('chat_radio_choose')}</Text><TouchableOpacity style={s.close} accessibilityRole="button" accessibilityLabel={t('cancel')} onPress={onClose}><Image source={require('../../../assets/images/share/close.svg')} style={{width:40,height:40}} contentFit="contain"/></TouchableOpacity></View>

 <View style={[s.search,searchFocused&&s.searchFocused]}><Image source={require('../../../assets/images/home/search.svg')} style={{width:24,height:24}} tintColor="#95949F" contentFit="contain"/><TextInput testID="chat-radio-search" onFocus={()=>setSearchFocused(true)} onBlur={()=>setSearchFocused(false)} style={[s.input,Platform.OS==='web'&&({outlineStyle:'none'} as any)]} placeholder={t('chat_radio_search')} placeholderTextColor="#92919B" value={input} onChangeText={setInput} maxLength={100}/></View>
 <View style={s.tabs}>{(['favorites','catalog'] as const).map(key=><TouchableOpacity key={key} style={[s.tab,source===key&&s.selected]} accessibilityRole="tab" accessibilityState={{selected:source===key}} onPress={()=>setSource(key)}><Text style={s.tabText}>{t(key==='favorites'?'chat_radio_favorites':'chat_radio_library')}</Text></TouchableOpacity>)}</View>
 <FlatList showsVerticalScrollIndicator={false} data={stations} style={{height:200}} keyExtractor={station=>station._id} keyboardShouldPersistTaps="handled" renderItem={({item})=><TouchableOpacity testID={`chat-radio-select-${item._id}`} style={s.station} accessibilityRole="button" onPress={()=>onSelect(item)}><ImageWithFallback uri={getStationLogoUrl(item)} style={s.logo} contentFit="cover"/><View style={{flex:1,minWidth:0}}><Text numberOfLines={1} style={s.name}>{item.name}</Text><Text numberOfLines={1} style={s.country}>{item.country||item.tags?.split(',')[0]}</Text></View><ChatIcon name="plus" size={19} color="#FFA5D0"/></TouchableOpacity>} ListEmptyComponent={source==='catalog'&&(result.isFetching||input.trim()!==query)?<MegaLoadingState variant="station-list" count={3} inset={0}/>:<View style={{padding:20,alignItems:'center'}}><Text style={s.country}>{t(result.isError?'chat_radio_load_error':'chat_radio_empty')}</Text>{result.isError&&<TouchableOpacity onPress={()=>result.refetch()} style={s.close}><Text style={s.tabText}>{t('retry')}</Text></TouchableOpacity>}</View>}/>
 </View>;
}
const s=StyleSheet.create({panel:{paddingHorizontal:16,paddingTop:14,paddingBottom:4},heading:{flexDirection:'row',alignItems:'center',gap:8},title:{color:'#FFF',fontFamily:'Ubuntu-Bold',fontSize:18,lineHeight:24,flex:1},close:{width:44,height:44,justifyContent:'center',alignItems:'center'},tabs:{flexDirection:'row',marginTop:12,marginBottom:8,gap:8},tab:{paddingHorizontal:14,paddingVertical:8,borderRadius:5,backgroundColor:'#34353B'},selected:{backgroundColor:'#74405E'},tabText:{fontFamily:'Ubuntu-Medium',fontSize:12,color:'#FFF'},searchFocused:{borderColor:'#9C5E81'},search:{borderWidth:1,borderColor:'#202126',flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'#202126',borderRadius:5,paddingHorizontal:12,marginTop:10},input:{flex:1,minWidth:0,height:38,paddingVertical:0,fontFamily:'Ubuntu-Regular',fontSize:13,color:'#FFF'},station:{flexDirection:'row',alignItems:'center',gap:11,minHeight:64,borderBottomWidth:1,borderColor:'#3A3B40'},logo:{width:42,height:42,borderRadius:9},name:{fontFamily:'Ubuntu-Medium',fontSize:13,color:'#FFF'},country:{fontFamily:'Ubuntu-Regular',fontSize:11,color:'#A9A6B3',marginTop:4}});
