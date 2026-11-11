import { MegaLoadingIndicator as ActivityIndicator } from '../MegaLoadingIndicator';
import React,{useEffect,useRef,useState} from 'react';
import {View,Text,TextInput,TouchableOpacity,StyleSheet,Platform} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {useTranslation} from 'react-i18next';
import {ChatIcon} from './ChatIcons';
import {MegaMarkIcon} from '../BrandIcons';
export function ChatComposer({value,onChange,onFocus,onSend,onEmoji,onRadio,disabled,sending,ready,panel,expanded,radioActive=false,maxLength=2000,focusRequest}:{value:string;onChange:(value:string)=>void;onFocus:()=>void;onSend:()=>void;onEmoji:()=>void;onRadio:()=>void;disabled:boolean;sending:boolean;ready:boolean;panel?:React.ReactNode;expanded:boolean;radioActive?:boolean;maxLength?:number;focusRequest?:string}){
 const {t}=useTranslation(),[focused,setFocused]=useState(false),input=useRef<TextInput>(null);
 useEffect(()=>{if(!focusRequest)return;const timer=setTimeout(()=>input.current?.focus(),220);return()=>clearTimeout(timer);},[focusRequest]);
 return <View testID="chat-composer" style={s.surface}>{expanded&&<View style={s.panel}>{panel}</View>}<View style={s.row}>

 <TouchableOpacity testID="chat-media-button" style={[s.smile,Platform.OS==='web'&&({outlineStyle:'none'} as any)]} accessibilityRole="button" accessibilityLabel="Emoji / GIF" disabled={disabled} onPress={onEmoji}><Text style={s.emojiFace} accessible={false}>😀</Text></TouchableOpacity>
 <View style={[s.pill,focused&&{borderColor:'#77576E'}]}><TextInput ref={input} testID="chat-input" style={[s.input,Platform.OS==='web'&&({outlineStyle:'none'} as any)]} placeholder={t('chat_write')} placeholderTextColor="#A3A0AC" accessibilityLabel={t('chat_write')} value={value} editable={!disabled} multiline={false} maxLength={maxLength} onFocus={()=>{setFocused(true);onFocus();}} onBlur={()=>setFocused(false)} onChangeText={onChange} returnKeyType="send" onSubmitEditing={()=>{if(ready&&!disabled)onSend();}} blurOnSubmit={false}/><TouchableOpacity testID="chat-radio-button" style={s.radio} accessibilityRole="button" accessibilityLabel={t('chat_radio_choose')} disabled={disabled} onPress={onRadio}><MegaMarkIcon color={radioActive?'#FF75B9':'#FFFFFF'}/></TouchableOpacity></View>
 <TouchableOpacity testID="chat-send" style={[s.send,(!ready||disabled)&&{opacity:.58}]} activeOpacity={.82} disabled={disabled||!ready} accessibilityRole="button" accessibilityLabel={t('chat_send')} onPress={onSend}><LinearGradient colors={ready?['#FF86BD','#FF4199','#E12A83']:['#D577A3','#B75B87','#924468']} locations={[0,.5,1]} start={{x:.1,y:0}} end={{x:.9,y:1}} style={s.sphere}><View pointerEvents="none" style={s.shine}/>{sending?<ActivityIndicator color="#FFF"/>:<View style={s.plane}><ChatIcon name="send" size={34}/></View>}</LinearGradient></TouchableOpacity>
 </View></View>;
}
const s=StyleSheet.create({
 surface:{position:'relative',backgroundColor:'#292A2D',zIndex:2},
 panel:{position:'absolute',bottom:'100%',left:0,right:0,backgroundColor:'#292A2D',borderTopLeftRadius:16,borderTopRightRadius:16,overflow:'hidden',paddingBottom:4},
 row:{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:10,paddingVertical:10},
 emojiFace:{fontSize:42,lineHeight:48,includeFontPadding:false,textAlign:'center'},
 smile:{width:48,height:48,alignItems:'center',justifyContent:'center',flexShrink:0},
 pill:{flex:1,minWidth:0,height:44,borderRadius:5,backgroundColor:'#3B3D41',borderWidth:1,borderColor:'#3B3D41',flexDirection:'row',alignItems:'center',paddingLeft:10},
 input:{flex:1,minWidth:0,height:42,borderWidth:0,paddingVertical:0,paddingHorizontal:0,fontSize:14,lineHeight:20,fontFamily:'Ubuntu-Regular',color:'#FFF',textAlignVertical:'center'},
 radio:{width:34,height:42,alignItems:'center',justifyContent:'center',flexShrink:0},
 send:{width:56,height:56,flexShrink:0,borderRadius:28,shadowColor:'#C43B91',shadowOffset:{width:0,height:3},shadowOpacity:.24,shadowRadius:8,elevation:3},
 sphere:{width:56,height:56,borderRadius:28,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#FFCAE85C',overflow:'hidden'},
 shine:{position:'absolute',top:3,left:10,width:36,height:17,borderRadius:18,backgroundColor:'#FFFFFF26',transform:[{rotate:'-22deg'}]},
 plane:{alignItems:'center',justifyContent:'center',transform:[{rotate:'-30deg'}]}
});
