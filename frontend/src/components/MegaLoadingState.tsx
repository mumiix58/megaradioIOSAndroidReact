import React from 'react';
import {View,StyleSheet,useWindowDimensions,type StyleProp,type ViewStyle} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Skeleton} from './Skeleton';

export type LoadingLayout='grid'|'genres'|'station-list'|'people'|'inbox'|'notifications'|'settings'|'text'|'statistics'|'genre-strip'|'conversation'|'countries'|'user-cards';
/** Content skeletons share motion/ink with each other; action controls keep the Mega ring. */
export function MegaLoadingState({variant='station-list',count=6,columns=3,gap=22.5,inset=15,availableWidth,page=false,style,testID='mega-content-loading'}:{variant?:LoadingLayout;count?:number;columns?:number;gap?:number;inset?:number;availableWidth?:number;page?:boolean;style?:StyleProp<ViewStyle>;testID?:string}){
 const {t}=useTranslation(),{width}=useWindowDimensions();
 const contentWidth=(availableWidth??width)-inset*2;
 const tile=(contentWidth-gap*(columns-1))/columns;
 const rows=Array.from({length:Math.min(count,12)},(_,index)=>index);
 return <View testID={testID} accessible accessibilityRole="progressbar" accessibilityLabel={t('loading','Loading')} style={[s.root,page&&{flex:1,minHeight:0},{paddingHorizontal:inset},style]}>
  {variant==='grid'?<View style={{flexDirection:'row',flexWrap:'wrap',gap}}>{rows.map(index=><View key={index} style={{width:tile}}>
   <Skeleton width="100%" height={tile} borderRadius={10}/>
   {variant==='grid'&&<><Skeleton width="86%" height={15} style={{marginTop:10}}/><Skeleton width="60%" height={12} style={{marginTop:5}}/></>}
  </View>)}</View>:variant==='genre-strip'?<View style={{flexDirection:'row',gap:12,overflow:'hidden'}}>{rows.map(index=><Skeleton key={index} width={130} height={45} borderRadius={6}/>)}</View>:variant==='conversation'?rows.map(index=><View key={index} style={{alignSelf:index%2?'flex-end':'flex-start',width:index%3===0?'72%':'55%',marginBottom:14}}><Skeleton width="100%" height={index%3===0?56:36} borderRadius={16}/></View>):variant==='statistics'?<>
   <View style={s.metric}><Skeleton width="60%" height={18}/><Skeleton width="42%" height={29} style={{marginTop:13}}/></View>
   {Array.from({length:Math.min(count,2)},(_,row)=><View key={row} style={{flexDirection:'row',gap:15,marginTop:15}}>{[0,1].map(index=><View key={index} style={[s.metric,{flex:1}]}><Skeleton width="85%" height={15}/><Skeleton width="55%" height={29} style={{marginTop:13}}/></View>)}</View>)}
  </>:variant==='text'?rows.map(index=><View key={index} style={{marginBottom:22}}><Skeleton width={index===0?'70%':'95%'} height={index===0?20:13}/><Skeleton width="100%" height={13} style={{marginTop:9}}/><Skeleton width="83%" height={13} style={{marginTop:9}}/></View>):rows.map(index=>{
   const notification=variant==='notifications',inbox=variant==='inbox',person=variant==='people',userCard=variant==='user-cards',genre=variant==='genres',country=variant==='countries',setting=variant==='settings'||genre;
   const size=notification?36:inbox?52:person?40:userCard?30:country?36:50;
   return <View key={index} style={[s.row,{minHeight:notification||genre?71:inbox?91:setting?75:person||country?70:userCard?60:80},(variant==='station-list'||country||userCard)&&s.station]}>
    {!setting&&<Skeleton width={size} height={country?24:size} borderRadius={notification||inbox||person||userCard?size/2:5}/>}
    <View style={{flex:1,gap:7}}><Skeleton width={notification?'80%':setting?'52%':'75%'} height={notification?13:15}/>{!setting&&<Skeleton width="55%" height={notification?12:13}/>}</View>
    <Skeleton width={notification?30:person?68:genre?36:setting||country||userCard?22:inbox?30:32} height={notification||inbox?10:genre?12:person?27:setting||country||userCard?18:32} borderRadius={person||variant==='station-list'?16:4}/>
   </View>;
  })}
 </View>;
}
const s=StyleSheet.create({root:{alignSelf:'stretch',paddingTop:12,paddingBottom:16,overflow:'hidden'},row:{flexDirection:'row',alignItems:'center',gap:12,borderBottomWidth:1,borderColor:'#FFFFFF09'},station:{backgroundColor:'#262626',borderRadius:10,paddingHorizontal:15,marginBottom:15,borderBottomWidth:0},metric:{minHeight:123,paddingHorizontal:20,paddingVertical:24,borderRadius:10,backgroundColor:'#282828'}});
