import {useCallback,useEffect,useRef,useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
const pending=new Map<string,Promise<unknown>>();
/** Once per account; the development preview never consumes the real tutorial. */
export function useProfilePhotoCoach(owner:string,visible:boolean,preview=false){
 const [shown,setShown]=useState(false),done=useRef(false),identity=useRef(owner);identity.current=owner;
 useEffect(()=>{done.current=false;setShown(false);},[owner,preview]);
 useEffect(()=>{
  let active=true;setShown(false);if(!owner||!visible||done.current)return;
  if(preview){setShown(true);return()=>{active=false;};}
  const key=`@mega_profile_photo_coach_v2:${owner}`;
  const task=(pending.get(key)||Promise.resolve()).catch(()=>{}).then(async()=>{
   if(!active||done.current||identity.current!==owner)return;
   const seen=await AsyncStorage.getItem(key);if(seen||!active||done.current||identity.current!==owner)return;
   await AsyncStorage.setItem(key,'seen');if(active&&!done.current)setShown(true);
  });
  pending.set(key,task);void task.catch(()=>{}).finally(()=>{if(pending.get(key)===task)pending.delete(key);});
  return()=>{active=false;};
 },[owner,visible,preview]);
 const dismiss=useCallback(()=>{done.current=true;setShown(false);},[]);
 return {shown,dismiss};
}
