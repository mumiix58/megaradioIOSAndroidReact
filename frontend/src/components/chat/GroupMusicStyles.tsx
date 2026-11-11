import React,{useState} from 'react';
import {GroupGenrePicker} from './GroupGenrePicker';
import {View,Text,TouchableOpacity,StyleSheet,Platform} from 'react-native';
import {useTranslation} from 'react-i18next';
export const GROUP_MUSIC_STYLES=['pop','rock','jazz','electronic','classical','hip-hop','rnb','folk','turkish','world','ambient','latin'] as const;
export function GroupMusicStyles({values,onChange,disabled=false,options,title,hint,appearance}:{values:string[];onChange?:(values:string[])=>void;disabled?:boolean;options?:readonly string[];title?:string;hint?:string;appearance?:'discovery'}){
 const {t}=useTranslation();
 const [picker,setPicker]=useState(false);
 const [names,setNames]=useState<Record<string,string>>({});
 const label=(id:string)=>t(`group_music_${id}`,{defaultValue:names[id]||id.replace(/-/g,' ').replace(/^./,c=>c.toUpperCase())});
 const available=options||GROUP_MUSIC_STYLES;
 const expandable=!!onChange;
 const choices=onChange?[...new Set([...(expandable?available.slice(0,-1):available),...values])]:values;
 if(!onChange&&!choices.length)return null;
 return <View style={s.section}><View style={s.heading}><Text style={s.title}>{title||t('group_music_title')}</Text>{onChange&&<Text style={s.count}>{values.length}/3</Text>}</View>{onChange&&<Text style={s.hint}>{hint||t('group_music_hint')}</Text>}<View style={[s.tags,appearance&&{columnGap:8,rowGap:9,marginTop:16}]}>{choices.map(id=>{const selected=values.includes(id),locked=disabled||(!selected&&values.length>=3);return onChange?<TouchableOpacity testID={`group-genre-${id}`} key={id} accessibilityRole="checkbox" accessibilityLabel={label(id)} accessibilityState={{checked:selected,disabled:locked}} {...(Platform.OS==='web'?{'aria-checked':selected}:{})} disabled={locked} hitSlop={{top:3,bottom:3,left:2,right:2}} onPress={()=>onChange(selected?values.filter(value=>value!==id):[...values,id])} style={[s.chip,appearance&&s.discoveryChip,selected&&s.selected,locked&&!selected&&s.dim]}><Text style={[s.text,appearance&&s.discoveryText,selected&&s.selectedText]}>{label(id)}</Text></TouchableOpacity>:<View key={id} style={s.readChip}><Text style={s.text}>{label(id)}</Text></View>;})}{expandable&&<TouchableOpacity testID="group-more-genres" accessibilityRole="button" disabled={disabled} onPress={()=>setPicker(true)} style={[s.chip,appearance&&s.discoveryChip,s.more]}><Text style={[s.text,appearance&&s.discoveryText]}>{t('group_more_genres','Diğer türler')} ···</Text></TouchableOpacity>}</View>{expandable&&<GroupGenrePicker visible={picker} values={values} onClose={()=>setPicker(false)} onSelect={genre=>{setNames(old=>({...old,[genre.slug]:genre.name}));onChange?.(values.includes(genre.slug)?values.filter(id=>id!==genre.slug):values.length<3?[...values,genre.slug]:values);}}/>}</View>;
}
// Five-pixel corners follow the existing Figma Home genre cards and radio-picker tabs.
const s=StyleSheet.create({
 section:{alignSelf:'stretch',paddingTop:6,paddingBottom:20},
 heading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
 title:{fontFamily:'Ubuntu-Medium',fontSize:14,lineHeight:18,color:'#F7F8FC'},
 count:{fontFamily:'Ubuntu-Regular',fontSize:11,lineHeight:16,color:'#92929C'},
 hint:{fontFamily:'Ubuntu-Regular',fontSize:12,lineHeight:17,color:'#9999A3',marginTop:4},
 tags:{flexDirection:'row',flexWrap:'wrap',columnGap:6,rowGap:7,marginTop:12},
 more:{borderWidth:1,borderColor:'#515158',backgroundColor:'transparent'},
 chip:{minHeight:30,paddingHorizontal:10,borderRadius:5,backgroundColor:'#303136',alignItems:'center',justifyContent:'center'},
 discoveryChip:{minHeight:37,paddingHorizontal:13,borderWidth:1,borderColor:'#FFFFFF0D',backgroundColor:'#28292D',borderRadius:6},
 discoveryText:{fontSize:13,lineHeight:18},
 selected:{backgroundColor:'#FF4199'},
 text:{fontFamily:'Ubuntu-Medium',fontSize:12,lineHeight:16,color:'#D3D3D9'},
 selectedText:{color:'#FFFFFF'},
 dim:{opacity:.5},
 readChip:{paddingHorizontal:10,paddingVertical:7,borderRadius:5,backgroundColor:'#303136'},
});
