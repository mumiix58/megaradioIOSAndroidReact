import {useAnalyticsOverlay} from '../../hooks/useAnalyticsOverlay';
import { MegaLoadingIndicator as ActivityIndicator } from '../MegaLoadingIndicator';
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {View,Text,Modal,Pressable,TouchableOpacity,StyleSheet,useWindowDimensions,AppState} from 'react-native';
import {Image} from 'expo-image';
import Svg,{Defs,RadialGradient,Stop,Rect} from 'react-native-svg';
import {useQuery} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import Animated,{useAnimatedStyle,useSharedValue,useReducedMotion,withTiming,runOnJS} from 'react-native-reanimated';
import {GestureDetector,GestureHandlerRootView} from 'react-native-gesture-handler';
import {useCarCarousel} from '../../hooks/useCarCarousel';
import {GroupDiscoverySphere} from './GroupDiscoverySphere';
import {GroupDiscoveryDeck} from './GroupDiscoveryDeck';
import {ElasticFrequency} from '../ElasticFrequency';
import {DISCOVERY_RELEASE_DURATION} from '../../utils/discoveryPullMotion';
import {WorldRadioDial} from '../WorldRadioDial';
import {MegaMarkIcon} from '../BrandIcons';
import {DiscoveryDepthBackdrop} from './DiscoveryDepthBackdrop';
import {groupDiscoveryHistory} from '../../services/groupDiscoveryHistory';
import {DiscoveryRadioVerifier} from '../../services/discoveryRadioVerifier';
import {radioDiscoveryQuery} from '../../services/radioDiscoveryQuery';
import {GroupDiscoveryCountry} from './GroupDiscoveryCountry';
import {worldCountryKeys} from '../../utils/worldCountryRotation';
import {groupRadioDiscoveryStep} from '../../utils/groupRadioDiscovery';
import {discoveryPullMotion} from '../../utils/discoveryPullMotion';
import type {Station} from '../../types';

const DISCOVERY_START_BUDGET=8000;

export type GroupRadioDiscoveryProps={privateChat?:boolean;historyOwner?:string;genres:string[];onClose:()=>void;onShare:(station:Station)=>Promise<void>;onPlay:(station:Station,signal?:AbortSignal)=>Promise<void>;onEdit:()=>void;playback?:{stationId?:string;state:string};onToggle?:()=>void};

export function GroupRadioDiscovery({historyOwner='guest',genres,onClose,onShare,onPlay,onEdit,playback,onToggle,privateChat=false}:GroupRadioDiscoveryProps){
 useAnalyticsOverlay(privateChat?'private-radio-discovery':'group-radio-discovery',true);
 const {t}=useTranslation(),{width,height}=useWindowDimensions();
 const unit=Math.min(1,(width-40)/375,(height-140)/650);
 const [revealed,setRevealed]=useState(false),[offerShare,setOfferShare]=useState(false);
 const decisionTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const reveal=useSharedValue(0),releaseChoices=useSharedValue<{left:number|null;right:number|null}>({left:null,right:null}),reduced=useReducedMotion();
 const [landed,setLanded]=useState<Station|undefined>(),[index,setIndex]=useState(0),[previewing,setPreviewing]=useState(false),[sharing,setSharing]=useState(false),[error,setError]=useState(''),[auditioned,setAuditioned]=useState(''),[failed,setFailed]=useState(''),[shared,setShared]=useState('');
 const lock=useRef(false),alive=useRef(true),posted=useRef(new Set<string>());
 const verifierRef=useRef<DiscoveryRadioVerifier|null>(null);if(!verifierRef.current)verifierRef.current=new DiscoveryRadioVerifier();const verifier=verifierRef.current;
 const playRequest=useRef<AbortController|null>(null),foreground=useRef(AppState.currentState!=='background'&&AppState.currentState!=='inactive'),recoveries=useRef(0),intentDeadline=useRef(0);
 const [retryFrom,setRetryFrom]=useState<number|null>(null),[wake,setWake]=useState(0);
 const history=groupDiscoveryHistory(historyOwner);
 const drawCount=useRef(0),pullDirection=useRef<'left'|'right'>('left');
 const [refill,setRefill]=useState(0),[pendingDraw,setPendingDraw]=useState(false),[drawStep,setDrawStep]=useState<number|null>(null);
 useEffect(()=>{alive.current=true;verifier.setActive(foreground.current);const sub=AppState.addEventListener('change',state=>{foreground.current=state==='active';verifier.setActive(foreground.current);if(!foreground.current){playRequest.current?.abort();lock.current=false;setPreviewing(false);}else setWake(value=>value+1);});return()=>{alive.current=false;sub.remove();playRequest.current?.abort();verifier.setActive(false);if(decisionTimer.current)clearTimeout(decisionTimer.current);};},[verifier]);
 const query=useQuery({...radioDiscoveryQuery(historyOwner,genres,refill),enabled:genres.length>0});
 const catalogLoading=query.isLoading||query.isFetching&&!query.data?.length;
 const deck=query.data||[],station=deck[index],motion=useSharedValue(0),phase=useSharedValue(0),busy=previewing||sharing;
 const chooseFresh=(current:number,genre?:string,direction:1|-1=1)=>{
  const countryBlocked=history.countries.blocked();
  const newCountryAvailable=deck.some(candidate=>!history.history.has(candidate)&&!verifier.blocked(candidate)&&!worldCountryKeys(candidate).some(key=>countryBlocked.has(key)));
  const excluded=(readyOnly:boolean)=>new Set(deck.filter(candidate=>history.history.has(candidate)||verifier.blocked(candidate)||readyOnly&&(!verifier.peek(candidate)||newCountryAvailable&&worldCountryKeys(candidate).some(key=>countryBlocked.has(key)))).map(candidate=>candidate._id));
  return groupRadioDiscoveryStep(deck,current,history.countries.blocked(),excluded(true),genre,direction)||groupRadioDiscoveryStep(deck,current,history.countries.blocked(),excluded(false),genre,direction);
 };
 // A decoder-verified URL is played; neither an HTTP response nor play() resolving is sufficient.
 const audition=useCallback(async(next:number)=>{
  const candidate=deck[next];if(!candidate||lock.current||!foreground.current)return;
  if(decisionTimer.current)clearTimeout(decisionTimer.current);setOfferShare(false);
  if(!intentDeadline.current)intentDeadline.current=Date.now()+DISCOVERY_START_BUDGET;
  const remaining=intentDeadline.current-Date.now();if(remaining<=0){setFailed(candidate._id);return;}
  playRequest.current?.abort();const request=new AbortController();playRequest.current=request;let budgetExpired=false;
  const deadlineTimer=setTimeout(()=>{budgetExpired=true;request.abort();},remaining);
  setRevealed(true);reveal.value=withTiming(1,{duration:reduced?0:680});
  lock.current=true;setPreviewing(true);setError('');setFailed('');setAuditioned('');
  try{
   const verified=await verifier.resolve(candidate,request.signal);
   if(!alive.current)return;if(request.signal.aborted){if(budgetExpired)setFailed(candidate._id);return;}
   if(!verified)throw new Error('Unplayable discovery stream');
   setLanded(verified);await onPlay(verified,request.signal);
   if(alive.current&&!request.signal.aborted){setAuditioned(candidate._id);history.remember(verified);drawCount.current++;decisionTimer.current=setTimeout(()=>{if(alive.current)setOfferShare(true);},1800);}
  }catch(reason){if(budgetExpired&&alive.current){setFailed(candidate._id);return;}if(reason instanceof Error&&reason.name==='AbortError'){request.abort();return;}if(alive.current&&!request.signal.aborted){verifier.reject(candidate);setFailed(candidate._id);setAuditioned('');if(recoveries.current<1&&Date.now()<intentDeadline.current){recoveries.current++;setRetryFrom(next);}}}
  finally{clearTimeout(deadlineTimer);if(playRequest.current===request){lock.current=false;if(alive.current)setPreviewing(false);}}
 },[deck,onPlay,reduced,reveal,verifier]);
 const wheel=useCarCarousel({unit,count:deck.length,visible:deck.length>0&&!busy,immediateStart:true,tapTarget:'current',onInteraction:()=>{recoveries.current=0;intentDeadline.current=Date.now()+DISCOVERY_START_BUDGET;},onPreview:setIndex,onCommit:next=>{
  if(!deck[next])return;
  if(verifier.blocked(deck[next])||history.history.has(deck[next])&&auditioned!==deck[next]._id){const fresh=chooseFresh(next,undefined,pullDirection.current==='right'?-1:1);if(fresh)wheel.step(fresh.distance,450);else{setRevealed(false);reveal.value=0;setIndex(0);setRefill(value=>value+1);}return;}
  void audition(next);
 }});
 const draw=(direction:'left'|'right'='left')=>{if(lock.current||wheel.isMoving()||!foreground.current)return;recoveries.current=0;intentDeadline.current=Date.now()+DISCOVERY_START_BUDGET;pullDirection.current=direction;if(!deck.length){if(catalogLoading)setPendingDraw(true);return;}if(decisionTimer.current)clearTimeout(decisionTimer.current);setOfferShare(false);setAuditioned('');setError('');setRevealed(true);reveal.value=withTiming(1,{duration:reduced?0:80});const choice=chooseFresh(index,genres[drawCount.current%genres.length],direction==='right'?-1:1);if(choice)wheel.step(choice.distance,DISCOVERY_RELEASE_DURATION);else{setRevealed(false);reveal.value=0;setIndex(0);setRefill(value=>value+1);}};
 const recordRelease=(direction:'left'|'right')=>{
  recoveries.current=0;intentDeadline.current=Date.now()+DISCOVERY_START_BUDGET;pullDirection.current=direction;
  if(decisionTimer.current)clearTimeout(decisionTimer.current);setOfferShare(false);setAuditioned('');setError('');setRevealed(true);
 };
 const {stepUI,motionPhase}=wheel;
 const releaseUI=useCallback((direction:'left'|'right')=>{
  'worklet';
  const distance=releaseChoices.value[direction];if(motionPhase.value!==0)return;
  if(distance===null){runOnJS(draw)(direction);return;}
  // Queue bookkeeping before a zero-duration reduced-motion commit, then move in this UI frame.
  runOnJS(recordRelease)(direction);reveal.value=withTiming(1,{duration:reduced?0:80});stepUI(distance,DISCOVERY_RELEASE_DURATION);
 },[releaseChoices,reveal,reduced,stepUI,motionPhase,draw,recordRelease]);
 const prepare=useCallback(()=>{
  if(!foreground.current||busy||!deck.length){releaseChoices.value={left:null,right:null};return;}if(wheel.isMoving())return;
  const genre=genres[drawCount.current%genres.length];
  const left=chooseFresh(index,genre,1),right=chooseFresh(index,genre,-1);
  releaseChoices.value={left:left?.distance??null,right:right?.distance??null};
  const choices=[left,right].flatMap(choice=>choice?[deck[choice.index]]:[]);
  verifier.warm(choices);
 },[deck,index,busy,wheel.isMoving,genres.join(','),verifier,releaseChoices]);
 useEffect(()=>{prepare();},[prepare,auditioned,wake,wheel.moving]);
 useEffect(()=>{
  if(retryFrom===null||busy)return;const from=retryFrom;setRetryFrom(null);
  const fresh=chooseFresh(from,undefined,pullDirection.current==='right'?-1:1);
  if(fresh)setDrawStep(fresh.distance);
 },[retryFrom,busy]);
 // A stream can fail after its preflight. Do not leave a known-dead radio as a successful discovery.
 useEffect(()=>{
  if(!auditioned||playback?.stationId!==auditioned||playback.state!=='error'||lock.current)return;
  const candidate=deck.find(item=>item._id===auditioned);if(!candidate)return;
  verifier.reject(candidate);setOfferShare(false);setAuditioned('');setFailed(candidate._id);
  if(recoveries.current<1){recoveries.current++;intentDeadline.current=Date.now()+DISCOVERY_START_BUDGET;setRetryFrom(deck.indexOf(candidate));}
 },[auditioned,playback?.stationId,playback?.state]);
 const share=async()=>{
  if(!offerShare||!station||lock.current||auditioned!==station._id||posted.current.has(station._id)||playback?.stationId===station._id&&playback.state==='error')return;
  const candidate=station;lock.current=true;setSharing(true);setError('');
  try{await onShare(candidate);posted.current.add(candidate._id);if(alive.current)setShared(candidate._id);}
  catch{if(alive.current)setError(t('group_discovery_failed'));}
  finally{lock.current=false;if(alive.current)setSharing(false);}
 };
 const rest=useCallback(()=>{},[]);
 // Recovery waits for the busy verification phase to end; normal release never uses this effect.
 useEffect(()=>{if(drawStep===null||!revealed||busy)return;setDrawStep(null);wheel.step(drawStep,DISCOVERY_RELEASE_DURATION);},[drawStep,revealed,busy,wheel.step]);
 // A pull made during warmup is committed exactly once when a verified deck arrives.
 useEffect(()=>{if(!pendingDraw)return;if(deck.length){setPendingDraw(false);draw(pullDirection.current);}else if(!catalogLoading)setPendingDraw(false);},[pendingDraw,deck.length,catalogLoading]);
 const rediscover=()=>{if(lock.current)return;if(playback?.stationId===station?._id&&playback?.state==='playing')onToggle?.();if(decisionTimer.current)clearTimeout(decisionTimer.current);setOfferShare(false);setLanded(undefined);setRevealed(false);setAuditioned('');setError('');reveal.value=withTiming(0,{duration:reduced?0:450});};
 const sphereTransition=useAnimatedStyle(()=>({opacity:1-reveal.value,transform:[{scale:1-reveal.value*.45},{translateY:-reveal.value*24}]}));
 const deckTransition=useAnimatedStyle(()=>{const pull=discoveryPullMotion(motion.value,unit);return {opacity:reveal.value,transform:[{scale:.74+reveal.value*.26},{translateY:(1-reveal.value)*36},{translateX:pull.translateX}]};});
 const close=()=>{if(!sharing)onClose();};
 const confirmed=!!station&&(shared===station._id||posted.current.has(station._id));
 const streamFailed=!!station&&(failed===station._id||playback?.stationId===station._id&&playback.state==='error');
 const ready=!!station&&auditioned===station._id&&!streamFailed&&!wheel.moving;
 const playing=ready&&playback?.stationId===station?._id&&playback.state==='playing';
 const playBusy=previewing||!!station&&playback?.stationId===station._id&&['loading','buffering'].includes(playback.state);
 const toggle=()=>{if(busy||playBusy||!station)return;if(ready&&playback?.stationId===station._id&&onToggle)onToggle();else void audition(index);};
 return <Modal visible transparent animationType="fade" onRequestClose={close}><GestureHandlerRootView style={s.overlay}>
  <DiscoveryDepthBackdrop/>
  <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel={t('cancel')} disabled={sharing} onPress={close}/>
  <View style={[s.stage,{width:Math.min(width,440)}]}>
   <View testID="group-discovery-aura" pointerEvents="none" style={[s.aura,{height:Math.min(780,height-24),opacity:.75}]}><Image source={require('../../../assets/images/chat/discovery-stage-material.png')} contentFit="fill" style={{position:'absolute',width:'100%',height:'100%',opacity:.65}}/><Svg width="100%" height="100%" viewBox="0 0 440 780" preserveAspectRatio="none"><Defs><RadialGradient id="group-frequency-field" cx="50%" cy="50%" rx="50%" ry="50%"><Stop offset="0" stopColor="#232327" stopOpacity=".48"/><Stop offset=".5" stopColor="#232327" stopOpacity=".38"/><Stop offset=".8" stopColor="#232327" stopOpacity=".12"/><Stop offset="1" stopColor="#232327" stopOpacity="0"/></RadialGradient></Defs><Rect width="440" height="780" fill="url(#group-frequency-field)"/></Svg></View>
   <View testID="group-discovery-dialog" style={[s.field,{width:Math.min(width-40,374)}]} accessibilityViewIsModal>
    <View style={s.heading}><MegaMarkIcon color="#FF4199"/><View style={{flex:1}}><Text style={s.title}>{t('group_discovery_title')}</Text>{privateChat?<TouchableOpacity testID="chat-discovery-edit-genres" accessibilityRole="button" accessibilityLabel={t('chat_discovery_edit')} disabled={busy} onPress={onEdit}><Text style={[s.sub,{color:'#FF92C6'}]}>{genres.map(id=>t(`group_music_${id}`,{defaultValue:id.replace(/-/g,' ').replace(/^./,c=>c.toUpperCase())})).join(' · ')} · {t('chat_discovery_change')}</Text></TouchableOpacity>:<Text style={s.sub}>{genres.map(id=>t(`group_music_${id}`,{defaultValue:id.replace(/-/g,' ').replace(/^./,c=>c.toUpperCase())})).join(' · ')||t('group_music_title')}</Text>}</View><TouchableOpacity testID="group-discovery-close" accessibilityRole="button" accessibilityLabel={t('cancel')} disabled={sharing} onPress={close} style={s.touch}><Image source={require('../../../assets/images/share/close.svg')} style={{width:28,height:28}}/></TouchableOpacity></View>
    {!genres.length?<View style={s.empty}><Text style={s.help}>{t('group_discovery_no_genres')}</Text><TouchableOpacity accessibilityRole="button" onPress={onEdit} style={s.retry}><Text style={s.pink}>{t('group_details')}</Text></TouchableOpacity></View>:!catalogLoading&&(query.isError||!station)?<View style={s.empty}><Text style={s.help}>{t(query.isError?'group_discovery_load_failed':'group_discovery_empty')}</Text><TouchableOpacity style={s.retry} accessibilityRole="button" onPress={()=>query.refetch()}><Text style={s.pink}>{t('retry')}</Text></TouchableOpacity></View>:<>
     <View style={{marginTop:8*unit}}><WorldRadioDial unit={unit} motionScale={.18} disabled={busy||pendingDraw} busy={busy||pendingDraw} appearance="elastic" motion={motion} phase={phase} onPrepare={prepare} onStart={rest} onRest={rest} onRelease={draw} onReleaseUI={releaseUI} labels={{accessibility:t(privateChat?'chat_discovery_dial':'group_discovery_dial'),hint:t('group_discovery_hint'),idle:revealed?t('group_discovery_found'):t('group_discovery_dial_label'),release:t('group_discovery_release')}}/></View>
     <View style={{height:242*unit,alignItems:'center',justifyContent:'center'}}>
      <Animated.View pointerEvents={revealed?'none':'auto'} accessibilityElementsHidden={revealed} importantForAccessibility={revealed?'no-hide-descendants':'auto'} aria-hidden={revealed} style={[{position:'absolute'},sphereTransition]}><TouchableOpacity testID="group-discovery-sphere-trigger" accessibilityRole={revealed?undefined:'button'} accessibilityLabel={t(privateChat?'chat_discovery_dial':'group_discovery_dial')} accessibilityState={{busy:!!catalogLoading||pendingDraw}} disabled={busy||revealed||pendingDraw} onPress={()=>draw()} activeOpacity={.94}><GroupDiscoverySphere unit={unit} motion={motion} active={!revealed}/></TouchableOpacity></Animated.View>
      <Animated.View pointerEvents={revealed?'auto':'none'} aria-hidden={!revealed} accessibilityElementsHidden={!revealed} importantForAccessibility={revealed?'auto':'no-hide-descendants'} style={[{position:'absolute'},deckTransition]}>{!!deck.length&&!!station&&<><GestureDetector gesture={wheel.gesture} touchAction="pan-y" userSelect="none"><View testID="group-discovery-carousel" pointerEvents={busy?'none':'auto'} accessible={revealed} accessibilityRole={revealed?'adjustable':undefined} accessibilityLabel={`${station.name} · ${t(privateChat?'chat_discovery_dial':'group_discovery_dial')}`} accessibilityActions={[{name:'increment'},{name:'decrement'}]} onAccessibilityAction={e=>{if(!busy&&revealed)wheel.step(e.nativeEvent.actionName==='decrement'?-1:1);}}><GroupDiscoveryDeck station={landed||station} active={revealed&&!!landed} deck={deck} unit={unit} position={wheel.position} slotsCount={wheel.slotsCount}/></View></GestureDetector><GroupDiscoveryCountry station={station} unit={unit} disabled={!revealed||!!wheel.moving||busy}/></>}</Animated.View>
     </View>
     {revealed?<>
      <View testID="group-discovery-station-slot" style={{height:60*unit,justifyContent:'center'}}><Text testID="group-discovery-station" style={[s.stationName,{fontSize:24*unit,lineHeight:30*unit}]} numberOfLines={2}>{station.name}</Text></View>

      <View style={s.controls}><TouchableOpacity testID="group-discovery-previous" accessibilityRole="button" accessibilityLabel={t('group_discovery_previous')} disabled={busy} style={s.touch} onPress={()=>{recoveries.current=0;intentDeadline.current=Date.now()+DISCOVERY_START_BUDGET;pullDirection.current='right';wheel.step(-1);}}><Image source={require('../../../assets/images/car-mode/previous.svg')} style={{width:22,height:22}}/></TouchableOpacity><TouchableOpacity testID="group-discovery-play" accessibilityRole="button" accessibilityLabel={t(playing?'chat_radio_pause':'chat_radio_listen')} accessibilityState={{busy:playBusy,disabled:busy||playBusy}} disabled={busy||playBusy} onPress={toggle} style={s.play}>{playBusy?<ActivityIndicator size="small" color="#FF4199"/>:<><ElasticFrequency unit={unit*.68} pull={phase} playing={!!playing} wave/>{!playing&&<View style={s.playOverlay}><Image source={require('../../../assets/images/player/play.svg')} style={{width:22,height:22}} contentFit="contain"/></View>}</>}</TouchableOpacity><TouchableOpacity testID="group-discovery-next" accessibilityRole="button" accessibilityLabel={t('group_discovery_next')} disabled={busy} style={s.touch} onPress={()=>{recoveries.current=0;intentDeadline.current=Date.now()+DISCOVERY_START_BUDGET;pullDirection.current='left';wheel.step(1);}}><Image source={require('../../../assets/images/car-mode/next.svg')} style={{width:22,height:22}}/></TouchableOpacity></View>
     </>:<View style={{height:60*unit+60,justifyContent:'center'}}><Text style={s.openingInstruction}>{t('group_discovery_orb_hint')}</Text></View>}
     <View style={[s.decision,{minHeight:116}]}>
      {catalogLoading?<View testID="group-discovery-warming" style={s.listening}><ActivityIndicator size="small" color="#FF4199"/><Text accessibilityLiveRegion="polite" style={s.help}>{t(privateChat?'chat_discovery_loading':'group_discovery_loading')}</Text></View>:previewing?<View style={s.listening}><ActivityIndicator size="small" color="#FF4199"/><Text style={s.help}>{t('group_discovery_preview_loading')}</Text></View>:streamFailed?<View style={s.question}><Text style={s.help}>{t('group_discovery_preview_failed')}</Text><TouchableOpacity testID="group-discovery-play-retry" accessibilityRole="button" style={s.retry} onPress={()=>draw()}><Text style={s.pink}>{t('group_discovery_rediscover')}</Text></TouchableOpacity></View>:ready&&offerShare?<View style={s.question}><TouchableOpacity testID="group-discovery-share" accessibilityRole="button" accessibilityState={{disabled:busy||confirmed,busy:sharing}} disabled={busy||confirmed} onPress={share} style={[s.share,confirmed&&s.shared]}>{sharing?<ActivityIndicator color="#FFF" size="small"/>:<Text accessibilityLiveRegion="polite" style={s.shareText}>{t(confirmed?'group_discovery_shared_button':'group_discovery_share')}</Text>}</TouchableOpacity><TouchableOpacity testID="group-discovery-rediscover" accessibilityRole="button" disabled={busy} onPress={rediscover} style={s.rediscover}><Text style={s.secondaryText}>{t('group_discovery_rediscover')}</Text></TouchableOpacity></View>:revealed?<Text style={s.instruction}>{t(ready?'group_discovery_private':privateChat?'chat_discovery_instruction':'group_discovery_instruction')}</Text>:null}
     </View>
    </>}{!!error&&<Text accessibilityLiveRegion="polite" style={s.error}>{error}</Text>}
   </View>
  </View>
 </GestureHandlerRootView></Modal>;
}
const s=StyleSheet.create({
 overlay:{flex:1,alignItems:'center',justifyContent:'center',overflow:'hidden'},stage:{alignItems:'center',justifyContent:'center'},
 aura:{position:'absolute',width:'115%',alignSelf:'center'},field:{paddingVertical:18},
 heading:{flexDirection:'row',alignItems:'center',gap:9,paddingHorizontal:14,paddingTop:8,paddingBottom:10,borderBottomWidth:.5,borderBottomColor:'#FFFFFF0B'},title:{fontFamily:'Ubuntu-Bold',fontSize:19,color:'#FFF'},sub:{fontFamily:'Ubuntu-Regular',fontSize:12,lineHeight:17,color:'#B4B5BE',marginTop:5},touch:{width:44,height:44,alignItems:'center',justifyContent:'center'},
 empty:{minHeight:300,alignItems:'center',justifyContent:'center',gap:14},help:{fontFamily:'Ubuntu-Regular',fontSize:12,lineHeight:19,textAlign:'center',color:'#C3C4CD'},
 stationName:{fontFamily:'Ubuntu-Bold',color:'#FFF',textAlign:'center',paddingHorizontal:10},
 controls:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginTop:8},play:{flex:1,maxWidth:224,height:52,alignItems:'center',justifyContent:'center'},playOverlay:{position:'absolute',width:32,height:32,borderRadius:16,alignItems:'center',justifyContent:'center',backgroundColor:'#1B1B1BE6'},openingInstruction:{fontFamily:'Ubuntu-Medium',fontSize:15,lineHeight:24,color:'#E0DDE2',textAlign:'center',paddingHorizontal:27},
 decision:{justifyContent:'center',paddingTop:12},instruction:{fontFamily:'Ubuntu-Regular',fontSize:13,lineHeight:20,color:'#C1C2CB',textAlign:'center',paddingHorizontal:30},
 question:{alignItems:'center',width:'100%',gap:2},share:{minHeight:46,width:'86%',paddingVertical:10,paddingHorizontal:16,borderRadius:8,backgroundColor:'#FF4199',alignItems:'center',justifyContent:'center'},shared:{backgroundColor:'#464852'},shareText:{fontFamily:'Ubuntu-Bold',fontSize:16,color:'#FFF',textAlign:'center'},rediscover:{minHeight:44,justifyContent:'center',alignItems:'center',paddingHorizontal:16},secondaryText:{fontFamily:'Ubuntu-Medium',fontSize:14,color:'#BDBBC5'},listening:{flexDirection:'row',justifyContent:'center',alignItems:'center',gap:9},
 retry:{padding:10,alignItems:'center'},pink:{fontFamily:'Ubuntu-Medium',fontSize:12,color:'#FF92C6'},error:{fontFamily:'Ubuntu-Regular',fontSize:12,lineHeight:18,textAlign:'center',color:'#FF9CC9',paddingTop:6},
});
