import React from 'react';
import {Platform,FlatList,View,Text,StyleSheet,TouchableOpacity} from 'react-native';
import {Redirect,useRouter} from 'expo-router';
import {Image} from 'expo-image';
import {SafeAreaView} from 'react-native-safe-area-context';
import {MegaLoadingState,type LoadingLayout} from '../src/components/MegaLoadingState';
import {MegaLoadingIndicator} from '../src/components/MegaLoadingIndicator';
const examples:[string,LoadingLayout,number][]=[['Radyo kataloğu','grid',6],['Müzik türleri','genres',6],['Ana sayfa tür şeridi','genre-strip',3],['Ana sayfa kullanıcı kartları','user-cards',3],['Radyo listesi','station-list',3],['Kullanıcılar / takip','people',3],['Konuşmalar','inbox',3],['Bildirim merkezi','notifications',3],['Sohbet geçmişi','conversation',4],['Dil / tercihler','settings',3],['Ülke seçimi','countries',3],['İstatistikler','statistics',1],['Bilgi sayfaları','text',2]];
export default function LoadingPreview(){
 const router=useRouter();
 if(!(__DEV__&&Platform.OS==='web'&&process.env.EXPO_PUBLIC_WEB_PREVIEW_PROXY==='1'))return <Redirect href="/(tabs)"/>;
 return <SafeAreaView style={s.screen} edges={['top']}><View style={s.header}><TouchableOpacity accessibilityRole="button" accessibilityLabel="Geri" onPress={()=>router.canGoBack()?router.back():router.replace('/(tabs)')} style={s.back}><Image source={require('../assets/images/all-stations/back.svg')} style={{width:24,height:24}} contentFit="contain"/></TouchableOpacity><Text style={s.title}>Yükleme durumları</Text></View><FlatList data={examples} keyExtractor={item=>item[1]} showsVerticalScrollIndicator={false} initialNumToRender={2} maxToRenderPerBatch={2} windowSize={3} contentContainerStyle={{paddingBottom:24}} ListHeaderComponent={<>
  <Text style={s.note}>Ortak bileşenlerin hareketli önizlemesi</Text>
  <View style={s.controls}><MegaLoadingIndicator size="large"/><View style={s.button}><MegaLoadingIndicator size="small" color="#FFFFFF"/></View></View>
  </>} renderItem={({item:[title,variant,count]})=><View style={s.section}><Text style={s.label}>{title}</Text><MegaLoadingState variant={variant} count={count}/></View>}/></SafeAreaView>;
}
const s=StyleSheet.create({screen:{flex:1,backgroundColor:'#1B1C1E'},header:{height:76,flexDirection:'row',alignItems:'center',paddingHorizontal:10,gap:12},back:{width:38,height:44,justifyContent:'center',alignItems:'center'},arrow:{fontSize:30,color:'#FFF'},title:{fontFamily:'Ubuntu-Bold',fontSize:18,color:'#FFF'},note:{fontFamily:'Ubuntu-Regular',fontSize:12,color:'#A4A4AE',paddingHorizontal:15},controls:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:32,padding:24},button:{backgroundColor:'#FF4199',height:44,width:100,borderRadius:8,alignItems:'center',justifyContent:'center'},section:{paddingBottom:20,borderTopWidth:1,borderColor:'#FFFFFF09'},label:{fontFamily:'Ubuntu-Medium',fontSize:13,color:'#A4A4AE',paddingHorizontal:15,paddingTop:18,paddingBottom:8}});
