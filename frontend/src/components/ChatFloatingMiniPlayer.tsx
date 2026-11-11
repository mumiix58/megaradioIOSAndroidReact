import {CoachHint} from './CoachHint';
import React,{useEffect,useMemo,useCallback,useRef,useState} from 'react';
import {Animated,Keyboard,PanResponder,Platform,View,Text,TouchableOpacity,useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {usePlayerStore} from '../store/playerStore';
import {useTranslation} from 'react-i18next';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {useLogoAccent} from '../hooks/useLogoAccent';
import {getStationLogoUrl} from '../utils/stationLogoHelper';
import {Image} from 'expo-image';
import {useMiniPlayerMoveHint} from '../hooks/useMiniPlayerMoveHint';
import {MiniPlayer} from './MiniPlayer';

/** Drag any non-control surface; only the visible screen edges constrain movement. */
export function ChatFloatingMiniPlayer({hintStorageKey,hidden=false}:{hintStorageKey?:string;hidden?:boolean}={}){
 const {t}=useTranslation();
 const enabled=usePlayerStore(state=>state.isMiniPlayerVisible&&!!state.currentStation),station=usePlayerStore(state=>state.currentStation);
 const visible=enabled&&!hidden,accent=useLogoAccent(getStationLogoUrl(station));
 const hint=useMiniPlayerMoveHint(visible,hintStorageKey);
 const {height,width}=useWindowDimensions(),insets=useSafeAreaInsets();
 const [keyboard,setKeyboard]=useState(0),[compact,setCompact]=useState(false);
 const playerWidth=compact?Math.min(264,width-24):Math.min(360,width-24),playerHeight=compact?84:103;
 const top=insets.top,bottom=Math.max(top,height-keyboard-insets.bottom-playerHeight);
 const right=Math.max(0,width-playerWidth);
 const initialY=Math.max(top,bottom-102);
 const x=useRef(new Animated.Value(12)).current,y=useRef(new Animated.Value(initialY)).current;
 const pending=useRef({x:0,y:0});
 const point=useRef({x:12,y:initialY}),origin=useRef({...point.current}),blocked=useRef(false),suppressUntil=useRef(0);
 const clamp=useCallback((next:{x:number;y:number})=>({x:Math.max(0,Math.min(right,next.x)),y:Math.max(top,Math.min(bottom,next.y))}),[right,top,bottom]);
 const settle=useCallback((next:{x:number;y:number})=>{const target=clamp(next);point.current=target;Animated.spring(x,{toValue:target.x,useNativeDriver:false,bounciness:0,speed:24}).start();Animated.spring(y,{toValue:target.y,useNativeDriver:false,bounciness:0,speed:24}).start();},[clamp,x,y]);
 useEffect(()=>{const show=Keyboard.addListener('keyboardDidShow',event=>setKeyboard(event.endCoordinates.height));const hide=Keyboard.addListener('keyboardDidHide',()=>setKeyboard(0));return()=>{show.remove();hide.remove();};},[]);
 useEffect(()=>{settle(point.current);},[settle]);
 const blockDrag=useCallback(()=>{blocked.current=true;},[]);
 const suppressSurfacePress=useCallback(()=>Date.now()<suppressUntil.current,[]);
 const pan=useMemo(()=>PanResponder.create({
  // Observe the start without stealing taps from playback, favorites or other actions.
  onStartShouldSetPanResponderCapture:()=>{blocked.current=false;pending.current={x:0,y:0};x.stopAnimation(value=>{origin.current.x=value;});y.stopAnimation(value=>{origin.current.y=value;});return false;},
  onMoveShouldSetPanResponderCapture:(_,gesture)=>{const capture=!blocked.current&&(gesture.numberActiveTouches||1)===1&&(Math.abs(gesture.dx)>5||Math.abs(gesture.dy)>5);if(capture)pending.current={x:gesture.dx,y:gesture.dy};return capture;},
  onPanResponderGrant:()=>{origin.current=clamp({x:origin.current.x+pending.current.x,y:origin.current.y+pending.current.y});point.current={...origin.current};x.setValue(origin.current.x);y.setValue(origin.current.y);suppressUntil.current=Date.now()+60000;hint.learned();},
  onPanResponderMove:(_,gesture)=>{const target=clamp({x:origin.current.x+gesture.dx,y:origin.current.y+gesture.dy});x.setValue(target.x);y.setValue(target.y);point.current=target;},
  onPanResponderRelease:(_,gesture)=>{suppressUntil.current=Date.now()+350;settle({x:origin.current.x+gesture.dx,y:origin.current.y+gesture.dy});},
  onPanResponderTerminate:()=>{suppressUntil.current=Date.now()+350;settle(point.current);},
  onPanResponderTerminationRequest:()=>false,
 }),[clamp,settle,x,y,hint.learned]);
 const moveAccessible=()=>{hint.learned();settle({x:point.current.x,y:point.current.y>top+10?top:bottom});};
 const toggleCompact=()=>{blocked.current=true;setCompact(value=>!value);};
 if(!visible)return null;
 return <Animated.View testID="chat-floating-player" {...pan.panHandlers} style={{position:'absolute',top:y,left:x,width:playerWidth,zIndex:100,elevation:12,borderRadius:10,overflow:'visible',backgroundColor:'#222222',shadowColor:'#000',shadowOpacity:.25,shadowRadius:12,...(Platform.OS==='web'?{touchAction:'none' as any}:{})}}>
  {hint.show&&<CoachHint testID="mini-player-move-hint" title={t('mini_player_coach_title','Hold, then drag up')} body={t('mini_player_coach_body','Hold any non-button area to move the player.')} style={{position:'absolute',bottom:'100%',alignSelf:'center',marginBottom:12,width:282,maxWidth:'96%'}}/>}
  <View style={{borderRadius:10,overflow:'hidden'}}>
   {accent&&<LinearGradient testID="chat-player-logo-surface" pointerEvents="none" colors={[`${accent}38`,`${accent}16`,`${accent}00`]} locations={[0,.5,.9]} start={{x:0,y:.5}} end={{x:1,y:.5}} style={{position:'absolute',top:compact?28:32,bottom:0,left:0,right:0}}/>}
  <View testID="chat-player-neutral-header" style={{height:compact?28:32,backgroundColor:'#222222',justifyContent:'center',alignItems:'center'}}>
   <View testID="chat-player-drag-handle" accessible accessibilityRole="button" accessibilityLabel={t('mini_player_move','Move player')} accessibilityHint={t('mini_player_move_hint','Hold any non-button area and drag.')} accessibilityActions={[{name:'activate'}]} onAccessibilityAction={moveAccessible} {...(Platform.OS==='web'?{tabIndex:0,onKeyDown:(event:any)=>{if(['Enter',' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();hint.learned();settle({x:point.current.x+(event.key==='ArrowRight'?32:event.key==='ArrowLeft'?-32:0),y:point.current.y+(event.key==='ArrowUp'?-60:['ArrowDown','Enter',' '].includes(event.key)?60:0)});}}}:{})} style={{width:'60%',height:'100%',alignItems:'center',justifyContent:'center'}}>
    <View style={{width:hint.show?42:32,height:hint.show?4:3,borderRadius:2,backgroundColor:hint.show?'#FF4199':'#777980'}}/>
   </View>
   <TouchableOpacity testID="chat-player-size-toggle" onPressIn={blockDrag} onPress={toggleCompact} accessibilityRole="button" accessibilityLabel={t(compact?'mini_player_restore':'mini_player_compact',compact?'Expand player':'Compact player')} hitSlop={6} style={{position:'absolute',right:5,top:0,width:36,height:compact?28:32,alignItems:'center',justifyContent:'center'}}><MaterialCommunityIcons name={compact?'arrow-expand':'arrow-collapse'} size={18} color="#D8D9DF"/></TouchableOpacity>
  </View>
  <MiniPlayer isGlobal floating compact={compact} onControlPressIn={blockDrag} suppressSurfacePress={suppressSurfacePress}/>
   <View testID="chat-player-logo-outline" pointerEvents="none" style={{position:'absolute',top:0,bottom:0,left:0,right:0,borderRadius:10,borderWidth:1,borderColor:'#FFFFFF14'}}/>
  </View>
 </Animated.View>;
}
