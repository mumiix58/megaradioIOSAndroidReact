import type {ContextMenuAnchor} from './ChatContextMenu';
import React,{useRef,useEffect,useMemo,useCallback,useState} from 'react';
import {Animated,PanResponder,Platform,View,Text,TouchableOpacity,StyleSheet} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {useTranslation} from 'react-i18next';
const ACTION_WIDTH=136;
/** Horizontal intent takes the responder; vertical scrolling and ordinary taps stay with the list. */
export function ChatInboxSwipeRow({id,opened,onOpen,onMore,onArchive,archived,disabled,children}:{id:string;opened:string|null;onOpen:(id:string|null)=>void;onMore:(anchor:ContextMenuAnchor)=>void;onArchive:()=>void;archived:boolean;disabled:boolean;children:(canPress:()=>boolean,metaStyle:{width:Animated.AnimatedInterpolation<number>;opacity:Animated.AnimatedInterpolation<number>;overflow:'hidden'},showMore:()=>void)=>React.ReactNode}){
 const rowRef=useRef<View>(null);
 const [rowWidth,setRowWidth]=useState(0);
 const {t}=useTranslation(),x=useRef(new Animated.Value(0)).current,point=useRef(0),origin=useRef(0),suppressUntil=useRef(0);
 const settle=useCallback((open:boolean)=>{point.current=open?-ACTION_WIDTH:0;Animated.spring(x,{toValue:point.current,useNativeDriver:false,bounciness:0,speed:28}).start();},[x]);
 useEffect(()=>{if(opened!==id)settle(false);},[opened,id,settle]);
 const pan=useMemo(()=>PanResponder.create({
  onStartShouldSetPanResponderCapture:()=>{origin.current=point.current;return false;},
  onMoveShouldSetPanResponderCapture:(_,g)=>{return !disabled&&Math.abs(g.dx)>9&&Math.abs(g.dx)>Math.abs(g.dy)*1.4;},
  onPanResponderGrant:()=>{x.stopAnimation(value=>{origin.current=value;});suppressUntil.current=Date.now()+60000;onOpen(id);},
  onPanResponderMove:(_,g)=>{const next=Math.max(-ACTION_WIDTH,Math.min(0,origin.current+g.dx));point.current=next;x.setValue(next);},
  onPanResponderRelease:(_,g)=>{suppressUntil.current=Date.now()+350;const open=g.vx<-.45||g.vx<.45&&point.current<-48;settle(open);onOpen(open?id:null);},
  onPanResponderTerminate:()=>{suppressUntil.current=Date.now()+350;settle(false);onOpen(null);},
  onPanResponderTerminationRequest:()=>false,
 }),[disabled,onOpen,id,x,settle]);
 const action=(run:()=>void)=>{settle(false);onOpen(null);run();};
 const showMore=()=>{if(disabled)return;rowRef.current?.measureInWindow((x,y,width,height)=>{if(width>0&&height>0)action(()=>onMore({x,y,width,height}));});};
 const closed=opened!==id;
 const metaStyle={width:x.interpolate({inputRange:[-ACTION_WIDTH,-48,0],outputRange:[0,0,64],extrapolate:'clamp'}),opacity:x.interpolate({inputRange:[-ACTION_WIDTH,-24,0],outputRange:[0,0,1],extrapolate:'clamp'}),overflow:'hidden' as const};
 const contentWidth=rowWidth?x.interpolate({inputRange:[-ACTION_WIDTH,0],outputRange:[Math.max(0,rowWidth-ACTION_WIDTH),rowWidth],extrapolate:'clamp'}):'100%';
 return <View ref={rowRef} testID={`inbox-swipe-${id}`} onLayout={event=>{const width=event.nativeEvent.layout.width;if(width>0)setRowWidth(width);}} style={[s.clip,Platform.OS==='web'&&({touchAction:'pan-y'} as any)]} {...pan.panHandlers}>
 <View style={s.actions} pointerEvents={closed?'none':'auto'} accessibilityElementsHidden={closed} importantForAccessibility={closed?'no-hide-descendants':'auto'} {...(Platform.OS==='web'?{'aria-hidden':closed}:{})}><TouchableOpacity testID={`inbox-more-${id}`} accessibilityRole="button" accessibilityLabel={t('inbox_more')} onPress={showMore} style={[s.action,s.more]}><MaterialCommunityIcons name="dots-horizontal" size={25} color="#FFF"/><Text style={s.label}>{t('inbox_more')}</Text></TouchableOpacity><TouchableOpacity testID={`inbox-archive-${id}`} accessibilityRole="button" accessibilityLabel={t(archived?'inbox_unarchive':'inbox_archive')} onPress={()=>action(onArchive)} style={[s.action,s.archive]}><MaterialCommunityIcons name={archived?'archive-arrow-up-outline':'archive-outline'} size={25} color="#FFF"/><Text style={s.label}>{t(archived?'inbox_unarchive':'inbox_archive')}</Text></TouchableOpacity></View>
 <Animated.View testID={`inbox-content-${id}`} style={[s.surface,{width:contentWidth}]}>{children(()=>{if(Date.now()<suppressUntil.current)return false;if(opened===id){settle(false);onOpen(null);return false;}return true;},metaStyle,showMore)}</Animated.View></View>;
}
const s=StyleSheet.create({clip:{overflow:'hidden',position:'relative',borderBottomWidth:1,borderColor:'#303135'},surface:{backgroundColor:'#1B1C1E',paddingRight:10},actions:{position:'absolute',right:0,top:0,bottom:0,width:ACTION_WIDTH,flexDirection:'row'},action:{width:68,justifyContent:'center',alignItems:'center',gap:7},more:{backgroundColor:'#35373C',borderLeftWidth:1,borderColor:'#FFFFFF09'},archive:{backgroundColor:'#A92366',borderLeftWidth:1,borderColor:'#FFFFFF0A'},label:{fontFamily:'Ubuntu-Medium',fontSize:12,color:'#FFF',textAlign:'center'}});
