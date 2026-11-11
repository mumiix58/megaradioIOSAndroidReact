import {useCallback,useEffect,useState,useRef} from 'react';
import {Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY='@megaradio_player_move_hint_v1';
let writes:Promise<unknown>=Promise.resolve();
const resetListeners=new Set<{key:string;reset:()=>void}>();
/** Explicit replay; normal visibility changes never reset learned progress. */
export async function resetMiniPlayerMoveHint(key=KEY){
 const task=writes.then(()=>AsyncStorage.removeItem(key));writes=task.catch(()=>{});await task;
 for(const listener of resetListeners)if(listener.key===key)listener.reset();
}
type Progress={shows:number;learned:boolean};
async function read(key:string):Promise<Progress>{
 try{const raw=await AsyncStorage.getItem(key);const value=raw?JSON.parse(raw):{};return {shows:Math.max(0,Number(value.shows)||0),learned:value.learned===true};}catch{return {shows:0,learned:false};}
}
// Serialize reservations so rapid screen changes cannot show more than three hints.
function reserve(key:string){
 const result=writes.then(async()=>{const progress=await read(key);if(progress.learned||progress.shows>=3)return false;await AsyncStorage.setItem(key,JSON.stringify({...progress,shows:progress.shows+1}));return true;});
 writes=result.catch(()=>{});return result;
}
export function useMiniPlayerMoveHint(visible:boolean,key=KEY){
 const [show,setShow]=useState(false),completed=useRef(false),[revision,setRevision]=useState(0);
 useEffect(()=>{
  const reset=()=>{completed.current=false;setShow(false);setRevision(value=>value+1);};
  const listener={key,reset};resetListeners.add(listener);
  const storage=(event:StorageEvent)=>{if(event.key===key&&event.newValue===null)reset();};
  if(Platform.OS==='web'&&typeof window!=='undefined')window.addEventListener('storage',storage);
  return()=>{resetListeners.delete(listener);if(Platform.OS==='web'&&typeof window!=='undefined')window.removeEventListener('storage',storage);};
 },[key]);
 useEffect(()=>{
  let active=true,timer:ReturnType<typeof setTimeout>|undefined;
  setShow(false);
  if(visible&&!completed.current)void reserve(key).then(allowed=>{if(active&&allowed&&!completed.current){setShow(true);timer=setTimeout(()=>setShow(false),9000);}}).catch(()=>{});
  return()=>{active=false;clearTimeout(timer);};
 },[visible,key,revision]);
 const learned=useCallback(()=>{
  setShow(false);
  if(completed.current)return;completed.current=true;
  writes=writes.then(async()=>{const progress=await read(key);await AsyncStorage.setItem(key,JSON.stringify({...progress,learned:true}));}).catch(()=>{});
 },[key]);
 return {show,learned};
}
