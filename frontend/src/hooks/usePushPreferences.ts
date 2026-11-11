import {useCallback,useEffect,useRef,useState} from 'react';
import {Platform,AppState} from 'react-native';
import {useAuthStore} from '../store/authStore';
import {cachePushPreference,getPushPreference,readCachedPushPreference,savePushPreference} from '../services/notificationPreferences';

type Notice=(error:boolean,key:string)=>void;
/** Phone push preference only. In-app inbox/bell queries remain independent. */
export function usePushPreferences(owner:string|undefined,authenticated:boolean,onNotice:Notice,preview=false){
 const [enabled,setEnabled]=useState(false),[ready,setReady]=useState(false),[saving,setSaving]=useState(false),[loadError,setLoadError]=useState(false),[needsSettings,setNeedsSettings]=useState(false);
 const [canRequestPermission,setCanRequestPermission]=useState(false);
 const session=useRef(0),busy=useRef(false);
 const refresh=useCallback(async()=>{
  const run=++session.current;setReady(false);setLoadError(false);setNeedsSettings(false);setCanRequestPermission(false);busy.current=false;setSaving(false);
  if(!owner||!authenticated){setEnabled(false);setReady(true);return;}
  setEnabled(false);
  try{
   const value=preview?(await readCachedPushPreference('preview:'+owner))??true:await getPushPreference(owner);
   if(run===session.current)setEnabled(value);
   if(!preview&&Platform.OS!=='web'){
    try{
     const Notifications=await import('expo-notifications');
     const permission=await Notifications.getPermissionsAsync();
     if(run===session.current){setNeedsSettings(value&&!permission.granted);setCanRequestPermission(permission.canAskAgain!==false);}
    }catch{if(run===session.current)setNeedsSettings(value);}
   }
  }catch{
   const cached=await readCachedPushPreference((preview?'preview:':'')+owner);
   if(run===session.current){setEnabled(cached??false);setLoadError(true);}
  }finally{if(run===session.current)setReady(true);}
 },[owner,authenticated,preview]);
 useEffect(()=>{void refresh();return()=>{session.current++;};},[refresh]);
 useEffect(()=>{if(Platform.OS==='web')return;const sub=AppState.addEventListener('change',state=>{if(state==='active'&&!busy.current)void refresh();});return()=>sub.remove();},[refresh]);
 const toggle=useCallback(async(value:boolean)=>{
  if(!owner||!authenticated||!ready||busy.current)return;
  if(loadError){void refresh();onNotice(true,'push_settings_retry');return;}
  const run=session.current,previous=enabled;
  const current=()=>run===session.current&&(preview||owner===(useAuthStore.getState().user?._id||useAuthStore.getState().user?.id));
  busy.current=true;setSaving(true);setEnabled(value);setNeedsSettings(false);
  try{
   if(value&&!preview&&Platform.OS!=='web'){
    const service=(await import('../services/pushNotificationService')).default;
    const token=await service.registerForPushNotifications({requestPermission:true});
    if(!current())return;
    if(!token){
     const Notifications=await import('expo-notifications');const permission=await Notifications.getPermissionsAsync();
     if(!permission.granted){if(current()){setNeedsSettings(true);setCanRequestPermission(permission.canAskAgain!==false);}throw Error('push-permission-required');}
     throw Error('push-device-unavailable');
    }
    await service.sendPushTokenToBackend(token);
   }
   if(!current())return;
   if(preview)await cachePushPreference('preview:'+owner,value);else await savePushPreference(owner,value);
   if(current())onNotice(false,value?'push_now_enabled':'push_now_disabled_short');
  }catch(error){
   if(current()){setEnabled(previous);onNotice(true,error instanceof Error&&error.message==='push-permission-required'?'push_permission_required':'push_save_failed');}
  }finally{if(run===session.current){busy.current=false;setSaving(false);}}
 },[owner,authenticated,ready,loadError,enabled,preview,onNotice,refresh]);
 return {enabled,ready,saving,loadError,needsSettings,canRequestPermission,refresh,toggle};
}
