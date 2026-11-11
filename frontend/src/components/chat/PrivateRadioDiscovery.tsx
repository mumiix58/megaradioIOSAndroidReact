import {useAnalyticsOverlay} from '../../hooks/useAnalyticsOverlay';
import React,{useEffect,useState} from 'react';
import {Modal,View,Text,TouchableOpacity,StyleSheet,ScrollView,useWindowDimensions,Platform} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Image} from 'expo-image';
import {useQueryClient} from '@tanstack/react-query';
import {radioDiscoveryQuery} from '../../services/radioDiscoveryQuery';
import {useTranslation} from 'react-i18next';
import {MegaMarkIcon} from '../BrandIcons';
import {GROUP_MUSIC_STYLES,GroupMusicStyles} from './GroupMusicStyles';
import {GroupRadioDiscovery,type GroupRadioDiscoveryProps} from './GroupRadioDiscovery';
import {PrivateDiscoveryHero} from './PrivateDiscoveryHero';

const choices=['love',...GROUP_MUSIC_STYLES];
/** Personal discovery choices are temporary, never a change to the other person's tastes. */
export function PrivateRadioDiscovery({partnerName,...props}:Omit<GroupRadioDiscoveryProps,'genres'|'onEdit'|'privateChat'>&{partnerName:string}){
 const {t}=useTranslation(),insets=useSafeAreaInsets(),{height}=useWindowDimensions(),queryClient=useQueryClient();
 const [genres,setGenres]=useState<string[]>([]),[choosing,setChoosing]=useState(true);
 const genreKey=genres.slice().sort().join(',');
 useEffect(()=>{if(!choosing||!genres.length)return;const timer=setTimeout(()=>{void queryClient.prefetchQuery(radioDiscoveryQuery(props.historyOwner||'guest',genres));},180);return()=>clearTimeout(timer);},[choosing,genreKey,props.historyOwner,queryClient]);
 useAnalyticsOverlay('private-discovery-genres',choosing);
 useEffect(()=>{if(!__DEV__||Platform.OS!=='web'||process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY!=='1')return;const notify=(visible:boolean)=>window.parent.postMessage({type:'megaradio-preview-theme',screen:'privateDiscoveryChoices',visible},'http://localhost:8082');notify(choosing);return()=>notify(false);},[choosing]);
 if(!choosing)return <GroupRadioDiscovery {...props} genres={genres} privateChat onEdit={()=>setChoosing(true)}/>;
 return <Modal visible animationType="fade" onRequestClose={props.onClose} statusBarTranslucent navigationBarTranslucent><View style={s.screen} accessibilityViewIsModal testID="chat-discovery-genres">
  <View style={[s.page,{paddingTop:Math.max(insets.top,14),paddingBottom:Math.max(insets.bottom,16)}]}>
   <View style={s.header}><View style={s.brand}><MegaMarkIcon color="#FF4199"/><Image source={require('../../../assets/images/chat/mega-wordmark-figma.svg')} style={{width:106,height:24}} contentFit="contain"/></View><TouchableOpacity testID="chat-discovery-genres-close" accessibilityRole="button" accessibilityLabel={t('cancel')} onPress={props.onClose} style={s.close}><Image source={require('../../../assets/images/share/close.svg')} style={{width:32,height:32}}/></TouchableOpacity></View>
   <ScrollView testID="chat-discovery-choice-scroll" style={{flex:1}} showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
    <View style={s.intro}><Text style={s.partner} numberOfLines={1}>{t('chat_discovery_with',{name:partnerName})}</Text><Text accessibilityRole="header" style={s.title}>{t('chat_discovery_choose')}</Text><Text style={s.subtitle}>{t('chat_discovery_world_hint')}</Text></View>
    <PrivateDiscoveryHero height={Math.min(280,Math.max(175,height*.3))}/>
    <GroupMusicStyles values={genres} onChange={setGenres} options={choices} appearance="discovery" title={t('chat_discovery_styles')} hint={t('chat_discovery_hint')}/>
   </ScrollView>
   <View style={s.footer}><TouchableOpacity testID="chat-discovery-start" accessibilityRole="button" accessibilityState={{disabled:!genres.length}} disabled={!genres.length} onPress={()=>setChoosing(false)} style={[s.start,!genres.length&&s.disabled]}><Text style={s.startText}>{t('chat_discovery_start')}</Text><Image source={require('../../../assets/images/favorites/discover-arrow.svg')} style={{width:24,height:24}} tintColor="#FFFFFF"/></TouchableOpacity><Text style={s.next}>{t('chat_discovery_next_hint')}</Text></View>
  </View>
 </View></Modal>;
}
const s=StyleSheet.create({
 screen:{flex:1,backgroundColor:'#1B1B1B'},page:{flex:1,width:'100%',maxWidth:480,alignSelf:'center',paddingHorizontal:24},
 header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',minHeight:48},brand:{flexDirection:'row',alignItems:'center',gap:10},close:{width:44,height:44,alignItems:'center',justifyContent:'center',marginRight:-8},
 content:{flexGrow:1,justifyContent:'center',paddingTop:12,paddingBottom:8},intro:{paddingTop:8},partner:{fontFamily:'Ubuntu-Regular',fontSize:12,lineHeight:18,color:'#A6A6B0',marginBottom:10},title:{fontFamily:'Ubuntu-Bold',fontSize:31,lineHeight:39,color:'#F7F8FC',letterSpacing:-.6},subtitle:{fontFamily:'Ubuntu-Regular',fontSize:15,lineHeight:22,color:'#BDBDC5',marginTop:9,maxWidth:330},
 footer:{paddingTop:12},start:{minHeight:50,borderRadius:8,backgroundColor:'#FF4199',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:15},disabled:{backgroundColor:'#5C2E44'},startText:{fontFamily:'Ubuntu-Bold',fontSize:16,color:'#FFF'},next:{fontFamily:'Ubuntu-Regular',fontSize:12,lineHeight:18,color:'#A6A6B0',textAlign:'center',paddingTop:13,paddingBottom:4},
});
