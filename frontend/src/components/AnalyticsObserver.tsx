import {useEffect} from 'react';
import {AppState,Platform} from 'react-native';
import {useSegments,useRootNavigationState} from 'expo-router';
import {usePlayerStore} from '../store/playerStore';
import {useAuthStore} from '../store/authStore';
import {usePremiumStore} from '../store/premiumStore';
import analyticsService from '../services/analyticsService';
import {analyticsSession} from '../services/analyticsRuntime';
import {analyticsScreenName} from '../services/analyticsSession';
export function AnalyticsObserver({opening=false}:{opening?:boolean}){
 const segments=useSegments(),navigation=useRootNavigationState();
 const route=analyticsScreenName(segments);
 useEffect(()=>{
  const auth=(s:ReturnType<typeof useAuthStore.getState>)=>{if(s.isAuthLoaded)void analyticsService.setUserId(s.isAuthenticated?s.user?.id||s.user?._id||null:null);};
  const playback=(s:ReturnType<typeof usePlayerStore.getState>)=>{const st=s.currentStation;analyticsSession.playback(st?{id:st._id,name:st.name,country:st.country,genre:st.tags?.split(',')[0]}:null,s.playbackState);};
  auth(useAuthStore.getState());playback(usePlayerStore.getState());
  const a=useAuthStore.subscribe((s,p)=>{if((s.user?.id||s.user?._id)!==(p.user?.id||p.user?._id)||s.isAuthenticated!==p.isAuthenticated||s.isAuthLoaded!==p.isAuthLoaded){analyticsSession.flush();auth(s);}});
  const p=usePlayerStore.subscribe((s,p)=>{if(s.currentStation!==p.currentStation||s.playbackState!==p.playbackState)playback(s);});
  const premium=usePremiumStore.subscribe((s,p)=>{if(s.isPremium!==p.isPremium)void analyticsService.setIsPremium(s.isPremium);if(s.plan!==p.plan)void analyticsService.setUserProperty('premium_plan',s.plan);});
  void analyticsService.setIsPremium(usePremiumStore.getState().isPremium);
  void analyticsService.setUserProperty('premium_plan',usePremiumStore.getState().plan);
  const active=()=>Platform.OS==='web'?document.visibilityState!=='hidden':AppState.currentState==='active';
  analyticsSession.setActive(active());
  const state=AppState.addEventListener('change',()=>analyticsSession.setActive(active()));
  const visibility=()=>analyticsSession.setActive(active());
  if(Platform.OS==='web')document.addEventListener('visibilitychange',visibility);
  const heartbeat=setInterval(()=>analyticsSession.heartbeat(),60000);
  return()=>{a();p();premium();state.remove();clearInterval(heartbeat);if(Platform.OS==='web')document.removeEventListener('visibilitychange',visibility);analyticsSession.dispose();};
 },[]);
 useEffect(()=>{if(!navigation?.key)return;if(opening)analyticsSession.overlay('startup','splash');analyticsSession.route(route);if(!opening)analyticsSession.overlay('startup',null);},[route,navigation?.key,opening]);
 return null;
}
