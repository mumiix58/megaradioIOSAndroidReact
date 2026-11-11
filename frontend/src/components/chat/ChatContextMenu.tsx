import { MegaLoadingIndicator as ActivityIndicator } from '../MegaLoadingIndicator';
import React from 'react';
import {Modal,View,Text,TouchableOpacity,Pressable,StyleSheet,useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import {MaterialCommunityIcons} from '@expo/vector-icons';
export type ContextMenuAnchor={x:number;y:number;width:number;height:number};
export type ChatContextAction={id:string;label:string;icon:React.ComponentProps<typeof MaterialCommunityIcons>['name'];run:()=>void;danger?:boolean};
/** Shared compact surface and viewport placement for message and inbox actions. */
export function ChatContextMenu({visible,anchor,rightAligned=true,busy,error,onClose,actions=[],prefix,menuTestID,dismissTestID,children,contentHeight,onDismiss}:{visible:boolean;anchor:ContextMenuAnchor|null;rightAligned?:boolean;busy:boolean;error:string;onClose:()=>void;actions?:ChatContextAction[];prefix:string;menuTestID:string;dismissTestID:string;children?:React.ReactNode;contentHeight?:number;onDismiss?:()=>void}){
 const {t}=useTranslation(),insets=useSafeAreaInsets(),window=useWindowDimensions();
 const width=Math.min(children?260:232,window.width-32),height=(contentHeight??actions.length*49+8)+(error?80:0),rect=anchor||{x:16,y:window.height/2,width:window.width-32,height:0};
 const left=Math.max(16,Math.min(window.width-width-16,rightAligned?rect.x+rect.width-width:rect.x));
 const below=rect.y+rect.height+height+8<window.height-insets.bottom-8;
 const top=Math.max(insets.top+8,Math.min(window.height-insets.bottom-height-8,below?rect.y+rect.height+8:rect.y-height-8));
 return <Modal onDismiss={onDismiss} visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={()=>{if(!busy)onClose();}}><View style={s.overlay}><Pressable testID={dismissTestID} style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel={t('cancel')} disabled={busy} onPress={onClose}/><View testID={menuTestID} accessibilityViewIsModal style={[s.menu,{left,top,width}]}>{children||actions.map((action,index)=><TouchableOpacity testID={`${prefix}-${action.id}`} key={action.id} style={[s.row,index>0&&s.divider]} disabled={busy} accessibilityRole="button" accessibilityLabel={action.label} onPress={action.run}><MaterialCommunityIcons name={action.icon} size={22} color={action.danger?'#FF739B':'#F7F8FC'}/><Text style={[s.label,action.danger&&s.danger]}>{action.label}</Text>{busy&&<ActivityIndicator size="small" color="#FF4199"/>}</TouchableOpacity>)}{!!error&&<Text accessibilityLiveRegion="polite" style={s.error}>{error}</Text>}</View></View></Modal>;
}
const s=StyleSheet.create({overlay:{flex:1,backgroundColor:'#00000028'},menu:{position:'absolute',backgroundColor:'#292A2DF7',borderRadius:16,paddingVertical:4,paddingHorizontal:16,borderWidth:1,borderColor:'#FFFFFF16',shadowColor:'#000',shadowOpacity:.3,shadowRadius:18,shadowOffset:{width:0,height:8},elevation:12},row:{minHeight:49,flexDirection:'row',alignItems:'center',gap:13},divider:{borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'#FFFFFF0D'},label:{flex:1,fontFamily:'Ubuntu-Regular',fontSize:15,lineHeight:21,color:'#F7F8FC'},danger:{color:'#FF739B'},error:{fontFamily:'Ubuntu-Regular',fontSize:12,lineHeight:18,color:'#FF9CC9',paddingVertical:8}});
