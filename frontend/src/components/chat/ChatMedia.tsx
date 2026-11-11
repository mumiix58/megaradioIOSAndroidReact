import {Skeleton} from '../Skeleton';
import { MegaLoadingIndicator as ActivityIndicator } from '../MegaLoadingIndicator';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, AccessibilityInfo } from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { gifConfigured, searchGifs, resolveGif, type ChatGif } from '../../services/chatGifs';
import { ChatIcon } from './ChatIcons';
const emojis = ['😀','😂','🥰','😊','😎','🤩','🥺','😢','🤔','🤗','🥳','👍','👏','🙌','🤝','❤️','💜','🔥','⭐','🎵','🎶','🎤','🎧','📻','🌍','🌈'];
export function GifImage({ reference }: { reference: string }) {
  const [reduce, setReduce] = useState(false);
  useEffect(() => { void AccessibilityInfo.isReduceMotionEnabled().then(setReduce); const sub = AccessibilityInfo.addEventListener('reduceMotionChanged',setReduce); return () => sub.remove(); }, []);
  const { data, isLoading } = useQuery({ queryKey: ['chat-gif', reference], queryFn: ({ signal }) => resolveGif(reference, signal), retry: false, staleTime: 0, gcTime: 0 });
  const { t } = useTranslation();
  return data ? <Image source={{ uri: reduce && data.still ? data.still : data.url }} style={{ width: 210, maxWidth: '100%', height: Math.min(220,210*data.height/data.width), borderRadius: 12 }} contentFit="contain" accessibilityLabel={data.title} /> : isLoading?<Skeleton width={210} height={150} borderRadius={12}/>:<Text style={s.notice}>{t('chat_gif_unavailable')}</Text>;
}
export function ChatMediaPicker({ onEmoji, onGif, onClose, initialTab = 'emoji', embedded = false }: { embedded?: boolean; initialTab?: 'emoji'|'gif'; onEmoji: (emoji: string) => void; onGif: (gif: ChatGif) => void; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<'emoji'|'gif'>(initialTab), [input, setInput] = useState(''), [query,setQuery] = useState(''), [page,setPage] = useState(1), [items,setItems] = useState<ChatGif[]>([]);
  useEffect(() => { if(input.trim()===query)return; const timer = setTimeout(() => {setQuery(input.trim());setPage(1);setItems([]);},350); return () => clearTimeout(timer); }, [input,query]);
  const result = useQuery({ queryKey: ['chat-gif-search',query,page,i18n.language], queryFn: ({signal}) => searchGifs(query,page,i18n.language,signal), enabled: tab === 'gif' && gifConfigured() && input.trim() === query, retry: false });
  useEffect(() => { if (result.data) setItems(old => page === 1 ? result.data.items : [...old,...result.data.items]); },[result.data,page]);
  return <View style={[s.picker,embedded&&{backgroundColor:'transparent',marginHorizontal:0,marginBottom:0,borderRadius:0}]} testID="chat-media-picker">
    <View style={s.tabs}>{(['emoji','gif'] as const).map(key => <TouchableOpacity key={key} style={[s.tab,tab===key&&s.selected]} onPress={()=>setTab(key)} accessibilityRole="tab" accessibilityState={{selected:tab===key}}><Text style={s.label}>{key==='gif'?'GIF':'Emoji'}</Text></TouchableOpacity>)}<View style={{flex:1}}/><TouchableOpacity style={s.close} accessibilityRole="button" accessibilityLabel={t('cancel','Cancel')} onPress={onClose}><Image source={require('../../../assets/images/share/close.svg')} style={{width:40,height:40}} contentFit="contain"/></TouchableOpacity></View>
    {tab==='emoji'?<View style={s.emojis}>{emojis.map(emoji=><TouchableOpacity key={emoji} style={s.emoji} accessibilityRole="button" accessibilityLabel={emoji} onPress={()=>onEmoji(emoji)}><Text style={{fontSize:26}}>{emoji}</Text></TouchableOpacity>)}</View>:!gifConfigured()?<Text style={s.notice}>{t('chat_gif_unavailable')}</Text>:<>
      <TextInput value={input} onChangeText={setInput} placeholder={t('chat_search_gifs')} placeholderTextColor="#999" style={s.search} accessibilityLabel={t('chat_search_gifs')} maxLength={100}/>
      <FlatList showsVerticalScrollIndicator={false} style={{height:210}} data={input.trim()===query?items:[]} keyExtractor={(item,index)=>`${item.slug}-${index}`} numColumns={3} keyboardShouldPersistTaps="handled" renderItem={({item})=><TouchableOpacity style={s.gif} accessibilityRole="button" accessibilityLabel={item.title} onPress={()=>onGif({...item,query})}><Image source={{uri:item.still||item.url}} style={{width:'100%',height:78}} contentFit="cover"/></TouchableOpacity>} ListEmptyComponent={(result.isFetching||input.trim()!==query)?<ActivityIndicator color="#FF4199"/>:<Text style={s.notice}>{t(result.isError?'chat_gif_unavailable':'chat_no_results')}</Text>} ListFooterComponent={result.isError?<TouchableOpacity onPress={()=>result.refetch()}><Text style={s.notice}>{t('retry','Retry')}</Text></TouchableOpacity>:result.data?.hasNext?<TouchableOpacity style={s.close} disabled={result.isFetching||input.trim()!==query} onPress={()=>setPage(n=>n+1)}><Text style={s.label}>{t('load_more','Load more')}</Text></TouchableOpacity>:null}/>
      <Text style={s.credit}>Powered by KLIPY</Text>
    </>}
  </View>;
}
const s=StyleSheet.create({picker:{backgroundColor:'#252629',padding:12,borderRadius:16,marginHorizontal:12,marginBottom:8},tabs:{flexDirection:'row',alignItems:'center',marginBottom:10,gap:6},tab:{paddingHorizontal:16,height:36,borderRadius:18,justifyContent:'center'},selected:{backgroundColor:'#FF4199'},label:{fontFamily:'Ubuntu-Medium',fontSize:13,color:'#FFF'},close:{minWidth:44,minHeight:40,alignItems:'center',justifyContent:'center'},emojis:{flexDirection:'row',flexWrap:'wrap',maxHeight:210},emoji:{width:'14.28%',height:44,justifyContent:'center',alignItems:'center'},search:{backgroundColor:'#191A1D',borderRadius:8,height:40,color:'#FFF',paddingHorizontal:12,fontFamily:'Ubuntu-Regular',marginBottom:10},gif:{width:'33.33%',padding:3,borderRadius:8,overflow:'hidden'},notice:{color:'#AAA',fontFamily:'Ubuntu-Regular',fontSize:13,padding:12},credit:{color:'#999',fontSize:10,textAlign:'right',marginTop:6}});
