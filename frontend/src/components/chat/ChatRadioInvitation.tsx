import React from 'react';
import {View,Text,TextInput,TouchableOpacity,StyleSheet,Platform} from 'react-native';
import {useTranslation} from 'react-i18next';
import type {RadioGift} from '../../utils/chatRadio';
import {ChatIcon} from './ChatIcons';

/** Choose the invitation after selecting the station, without changing the message composer. */
export function ChatRadioInvitation({intent,caption,onIntent,onCaption,disabled}:{intent:RadioGift['intent'];caption:string;onIntent:(value:RadioGift['intent'])=>void;onCaption:(value:string)=>void;disabled:boolean}){
 const {t}=useTranslation();
 return <View testID="chat-radio-invitation-options">
  <View style={s.options}>{(['together','gift'] as const).map(key=><TouchableOpacity key={key} testID={`chat-radio-intent-${key}`} accessibilityRole="button" accessibilityState={{selected:intent===key}} disabled={disabled} style={[s.option,intent===key&&s.selected]} onPress={()=>onIntent(key)}><Text style={[s.label,intent===key&&s.selectedLabel]}>{t(key==='together'?'chat_radio_together':'chat_radio_gift')}</Text></TouchableOpacity>)}
   <TouchableOpacity testID="chat-radio-custom" accessibilityRole="button" accessibilityLabel={t('chat_write')} accessibilityState={{selected:intent==='custom'}} disabled={disabled} style={[s.option,s.custom,intent==='custom'&&s.selected]} onPress={()=>onIntent('custom')}><ChatIcon name="plus" size={18} color={intent==='custom'?'#FFD4EB':'#AAA8B3'}/></TouchableOpacity>
  </View>
  {intent==='custom'&&<TextInput testID="chat-radio-invitation" style={[s.input,Platform.OS==='web'&&({outlineStyle:'none'} as any)]} value={caption} onChangeText={onCaption} placeholder={t('chat_write')} placeholderTextColor="#92919B" maxLength={300} autoFocus editable={!disabled} accessibilityLabel={t('chat_write')}/>}
 </View>;
}
const s=StyleSheet.create({options:{flexDirection:'row',gap:8,marginTop:10},option:{borderWidth:1,borderColor:'#45414C',borderRadius:5,paddingHorizontal:10,height:36,justifyContent:'center',alignItems:'center'},custom:{width:34,paddingHorizontal:0},selected:{borderColor:'#9C5E81',backgroundColor:'#513448'},label:{fontFamily:'Ubuntu-Regular',fontSize:11,lineHeight:16,includeFontPadding:false,textAlignVertical:'center',color:'#AAA8B3'},selectedLabel:{color:'#FFD4EB'},input:{height:40,minHeight:40,backgroundColor:'#3B3D41',borderRadius:5,paddingHorizontal:10,paddingVertical:0,marginTop:10,fontFamily:'Ubuntu-Regular',fontSize:13,color:'#FFF'}});
