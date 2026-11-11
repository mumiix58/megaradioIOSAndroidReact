import {useAnalyticsOverlay} from '../../hooks/useAnalyticsOverlay';
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Modal,View,Text,TextInput,Pressable,StyleSheet,Keyboard,Platform} from 'react-native';
import {Image} from 'expo-image';
import {useQuery} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import api from '../../services/api';
import type {Genre,GenreResponse} from '../../types';
import {useMegaSearchFocus} from '../../hooks/useMegaSearchFocus';
import {MegaLoadingIndicator} from '../MegaLoadingIndicator';
import {GenreWheel} from './GenreWheel';
const ROW=46;
export function GroupGenrePicker({visible,values,onClose,onSelect}:{visible:boolean;values:string[];onClose:()=>void;onSelect:(genre:Genre)=>void}){
 useAnalyticsOverlay('group-genre-picker',visible);
 const {t}=useTranslation();const focus=useMegaSearchFocus();
 const [search,setSearch]=useState(''),[index,setIndex]=useState(0);
 // Freeze priority while open: removing a selection must not move the wheel.
 const opening=useRef({visible:false,selected:[] as string[]});
 if(visible&&!opening.current.visible)opening.current.selected=[...values];
 opening.current.visible=visible;
 const priority=opening.current.selected.join(',');
 useEffect(()=>{if(visible){setSearch('');setIndex(0);}},[visible]);
 useEffect(()=>{if(!__DEV__||Platform.OS!=='web'||process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY!=='1')return;const notify=(active:boolean)=>window.parent.postMessage({type:'megaradio-preview-theme',screen:'genrePicker',visible:active},'http://localhost:8082');notify(visible);return()=>notify(false);},[visible]);
 // This component mounts with the style form: warm the shared catalog before More is tapped.
 const catalog=useQuery({queryKey:['group-global-genre-catalog'],staleTime:10*60*1000,gcTime:30*60*1000,queryFn:async({signal})=>{
  const page=async(n:number)=>(await api.get<GenreResponse>('/api/genres',{params:{page:n,limit:500},signal,timeout:8000})).data;
  const first=await page(1),pages=[first];let next=2;
  await Promise.all(Array.from({length:Math.min(4,Math.max(0,first.totalPages-1))},async()=>{while(next<=first.totalPages)pages.push(await page(next++));}));
  return [...new Map(pages.flatMap(p=>p.data).filter(g=>g.slug&&g.name).map(g=>[g.slug,g])).values()].sort((a,b)=>(b.stationCount||b.total_stations||0)-(a.stationCount||a.total_stations||0)||a.name.localeCompare(b.name));
 }});
 const choices=useMemo(()=>{const q=search.trim().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();const data=catalog.data||[],bySlug=new Map(data.map(g=>[g.slug,g]));const selected=opening.current.selected.map(id=>bySlug.get(id)||{_id:id,slug:id,name:t(`group_music_${id}`,{defaultValue:id.replace(/-/g,' ').replace(/^./,c=>c.toUpperCase())})});const ordered=[...selected,...data.filter(g=>!opening.current.selected.includes(g.slug))];return ordered.filter(g=>(g.name+' '+g.slug).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().includes(q));},[catalog.data,search,priority,t]);
 const chosen=choices[Math.min(index,Math.max(0,choices.length-1))],selected=!!chosen&&values.includes(chosen.slug),full=values.length>=3&&!selected;
 const close=()=>{Keyboard.dismiss();onClose();};
 return <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
  <View style={s.overlay}><Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel={t('cancel')}/>
   <View style={s.box} accessibilityViewIsModal testID="group-genre-picker">
    <View style={s.heading}><Text style={s.title}>{t('group_more_genres','Diğer türler')}</Text><Pressable onPress={close} testID="group-genre-picker-close" accessibilityRole="button" accessibilityLabel={t('close','Kapat')} hitSlop={8}><Image source={require('../../../assets/images/share/close.svg')} style={{width:28,height:28}}/></Pressable></View>
    <View style={[s.search,focus.fieldStyle]}><Image source={require('../../../assets/images/home/search.svg')} style={{width:24,height:24}} tintColor="#616161"/><TextInput testID="group-genre-search" style={[s.input,focus.inputStyle]} selectionColor={focus.selectionColor} onFocus={focus.onFocus} onBlur={focus.onBlur} value={search} placeholder={t('search_genres','Tür ara')} placeholderTextColor="#616161" onChangeText={value=>{setSearch(value);setIndex(0);}}/>{!!search&&<Pressable onPress={()=>{setSearch('');setIndex(0);}} accessibilityRole="button" accessibilityLabel={t('clear')}><Image source={require('../../../assets/images/favorites/clear.svg')} style={{width:24,height:24}}/></Pressable>}</View>
    <View style={s.wheel}>
    {catalog.isPending?<View style={s.center}><MegaLoadingIndicator/></View>:catalog.isError?<Pressable style={s.center} onPress={()=>catalog.refetch()} accessibilityRole="button"><Text style={s.hint}>{t('retry','Tekrar dene')}</Text></Pressable>:!choices.length?<View style={s.center}><Text style={s.hint}>{t('no_genres_found','Tür bulunamadı')}</Text></View>:<>
     <GenreWheel key={`${search}:${priority}:${choices.length}:${choices[0]?.slug}`} choices={choices} values={values} onChange={setIndex}/></>}
    </View>
    <View style={s.bottom}><Text style={s.hint}>{values.length}/3</Text><Pressable testID="group-genre-add" accessibilityRole="button" disabled={!chosen||full||catalog.isError} onPress={()=>{if(chosen){onSelect(chosen);if(!selected)close();}}} style={[s.add,(!chosen||full||catalog.isError)&&{opacity:.4}]}><Text style={s.addText}>{selected?t('group_genre_remove','Kaldır'):t('group_genre_add','Ekle')}</Text></Pressable></View>
   </View>
  </View>
 </Modal>;
}
const s=StyleSheet.create({overlay:{flex:1,justifyContent:'center',alignItems:'center',padding:20,backgroundColor:'#00000066'},box:{width:302,maxWidth:'100%',backgroundColor:'#000000',borderWidth:1,borderColor:'#292929',borderRadius:6,padding:18},heading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:16},title:{fontFamily:'Ubuntu-Medium',fontSize:17,color:'#FFF'},search:{height:42,borderRadius:8,backgroundColor:'#F7F8FC',flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:8},input:{flex:1,minWidth:0,height:40,padding:0,borderWidth:0,color:'#1B1C1E',fontFamily:'Ubuntu-Medium',fontSize:14},wheel:{height:ROW*5,marginTop:18,marginBottom:18,marginHorizontal:-18,overflow:'hidden'},selection:{backgroundColor:'#131313',borderRadius:4},row:{height:ROW,justifyContent:'center',alignItems:'center',paddingHorizontal:8},genre:{fontFamily:'Ubuntu-Medium',fontSize:18,lineHeight:24},center:{flex:1,alignItems:'center',justifyContent:'center'},hint:{fontFamily:'Ubuntu-Regular',fontSize:12,color:'#9999A3'},bottom:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},add:{backgroundColor:'#FF4199',borderRadius:5,paddingHorizontal:26,paddingVertical:10},addText:{fontFamily:'Ubuntu-Medium',fontSize:14,color:'#FFF'}});
